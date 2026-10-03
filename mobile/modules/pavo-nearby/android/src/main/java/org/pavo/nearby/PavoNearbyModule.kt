package org.pavo.nearby

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.StatFs
import androidx.core.content.ContextCompat
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.nearby.Nearby
import com.google.android.gms.nearby.connection.AdvertisingOptions
import com.google.android.gms.nearby.connection.ConnectionInfo
import com.google.android.gms.nearby.connection.ConnectionLifecycleCallback
import com.google.android.gms.nearby.connection.ConnectionResolution
import com.google.android.gms.nearby.connection.DiscoveredEndpointInfo
import com.google.android.gms.nearby.connection.DiscoveryOptions
import com.google.android.gms.nearby.connection.EndpointDiscoveryCallback
import com.google.android.gms.nearby.connection.Payload
import com.google.android.gms.nearby.connection.PayloadCallback
import com.google.android.gms.nearby.connection.PayloadTransferUpdate
import com.google.android.gms.nearby.connection.Strategy
import expo.modules.interfaces.permissions.Permissions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.InputStream
import java.security.MessageDigest

/**
 * Thin, offline transport over Google Nearby Connections. The PAVO session
 * protocol (offer, approval, receipt) lives in TypeScript; this module moves
 * bounded text messages and approved files, and never accepts a file the app
 * did not approve first.
 */
class PavoNearbyModule : Module() {
  private val serviceId = "org.pavo.learninghub"
  private val strategy = Strategy.P2P_POINT_TO_POINT
  private val maxTextBytes = 16 * 1024

  private val peers = linkedMapOf<String, String>()
  private val pendingConnections = mutableSetOf<String>()
  private val connectedPeers = mutableSetOf<String>()
  private val allowances = mutableMapOf<String, Allowance>()
  private val incoming = mutableMapOf<Long, Incoming>()
  private val outgoing = mutableMapOf<Long, Outgoing>()

  private val context
    get() = requireNotNull(appContext.reactContext)

  private val client
    get() = Nearby.getConnectionsClient(context)

  private val permissionsManager: Permissions
    get() = appContext.permissions ?: throw Exceptions.PermissionsModuleNotFound()

  private val partialDirectory
    get() = File(context.filesDir, "pavo-partial").apply { mkdirs() }

  private val incomingDirectory
    get() = File(context.filesDir, "pavo-incoming").apply { mkdirs() }

  override fun definition() = ModuleDefinition {
    Name("PavoNearby")

    Events(
      "onPeersChanged",
      "onVerificationCode",
      "onConnectionStateChanged",
      "onTextReceived",
      "onTransferProgress",
      "onFileReceived",
      "onIncomingInterrupted",
      "onUnsolicitedFile",
      "onNotificationCancel"
    )

    Function("isAvailable") { true }

    /** Nearby Connections needs Google Play services; report why it may be missing. */
    Function("gmsStatus") {
      when (GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(context)) {
        ConnectionResult.SUCCESS -> "available"
        ConnectionResult.SERVICE_VERSION_UPDATE_REQUIRED -> "update_required"
        ConnectionResult.SERVICE_DISABLED -> "disabled"
        else -> "missing"
      }
    }

    AsyncFunction("requestPermissions") { promise: Promise ->
      Permissions.askForPermissionsWithPermissionsManager(permissionsManager, promise, *requiredPermissions())
    }

    Function("freeBytes") { StatFs(context.filesDir.path).availableBytes.toDouble() }

    AsyncFunction("startAdvertising") { name: String, promise: Promise ->
      client.startAdvertising(name.take(60), serviceId, lifecycle, AdvertisingOptions.Builder().setStrategy(strategy).build())
        .addOnSuccessListener { promise.resolve() }
        .addOnFailureListener { error -> promise.reject("E_ADVERTISE", error.message, error) }
    }

    AsyncFunction("stopAdvertising") { promise: Promise ->
      client.stopAdvertising()
      promise.resolve()
    }

    AsyncFunction("startDiscovery") { promise: Promise ->
      peers.clear()
      emitPeers()
      client.startDiscovery(serviceId, discovery, DiscoveryOptions.Builder().setStrategy(strategy).build())
        .addOnSuccessListener { promise.resolve() }
        .addOnFailureListener { error -> promise.reject("E_DISCOVERY", error.message, error) }
    }

    AsyncFunction("stopDiscovery") { promise: Promise ->
      client.stopDiscovery()
      promise.resolve()
    }

    AsyncFunction("requestConnection") { peerId: String, localName: String, promise: Promise ->
      client.requestConnection(localName.take(60), peerId, lifecycle)
        .addOnSuccessListener { promise.resolve() }
        .addOnFailureListener { error -> promise.reject("E_CONNECTION", error.message, error) }
    }

    AsyncFunction("acceptConnection") { peerId: String, accept: Boolean, promise: Promise ->
      if (!pendingConnections.remove(peerId)) {
        promise.reject("E_CONNECTION", "No pending connection for this device.", null)
        return@AsyncFunction
      }
      val task = if (accept) client.acceptConnection(peerId, payloads) else client.rejectConnection(peerId)
      task.addOnSuccessListener { promise.resolve() }
        .addOnFailureListener { error -> promise.reject("E_CONNECTION", error.message, error) }
    }

    AsyncFunction("disconnect") { peerId: String, promise: Promise ->
      client.disconnectFromEndpoint(peerId)
      connectedPeers.remove(peerId)
      allowances.remove(peerId)
      promise.resolve()
    }

    /** Releases every radio: used when a session ends or the screen closes. */
    AsyncFunction("stopAll") { promise: Promise ->
      client.stopAdvertising()
      client.stopDiscovery()
      client.stopAllEndpoints()
      peers.clear()
      pendingConnections.clear()
      connectedPeers.clear()
      allowances.clear()
      promise.resolve()
    }

    AsyncFunction("sendText") { peerId: String, text: String, promise: Promise ->
      val bytes = text.toByteArray(Charsets.UTF_8)
      if (bytes.size > maxTextBytes) {
        promise.reject("E_TEXT", "Control message is too large.", null)
        return@AsyncFunction
      }
      if (!connectedPeers.contains(peerId)) {
        promise.reject("E_NOT_CONNECTED", "Connect and verify this device first.", null)
        return@AsyncFunction
      }
      client.sendPayload(peerId, Payload.fromBytes(bytes))
        .addOnSuccessListener { promise.resolve() }
        .addOnFailureListener { error -> promise.reject("E_TEXT", error.message, error) }
    }

    AsyncFunction("sendFile") { peerId: String, fileUri: String, offset: Double, promise: Promise ->
      if (!connectedPeers.contains(peerId)) {
        promise.reject("E_NOT_CONNECTED", "Connect and verify this device first.", null)
        return@AsyncFunction
      }
      try {
        val source = fileFromUri(fileUri)
        val payload = Payload.fromFile(source).apply {
          setSensitive(true)
          if (offset > 0) setOffset(offset.toLong())
        }
        outgoing[payload.id] = Outgoing(peerId, source.length(), offset.toLong())
        client.sendPayload(peerId, payload)
          .addOnSuccessListener { promise.resolve(payload.id.toString()) }
          .addOnFailureListener { error ->
            outgoing.remove(payload.id)
            promise.reject("E_TRANSFER", error.message, error)
          }
      } catch (error: Exception) {
        promise.reject("E_FILE", error.message, error)
      }
    }

    AsyncFunction("cancelPayload") { payloadId: String, promise: Promise ->
      client.cancelPayload(payloadId.toLong())
        .addOnSuccessListener { promise.resolve() }
        .addOnFailureListener { error -> promise.reject("E_TRANSFER", error.message, error) }
    }

    /** Approves exactly one file from this device for an accepted offer. */
    Function("allowIncoming") { peerId: String, transferId: String, totalBytes: Double, offset: Double ->
      require(Regex("^[A-Za-z0-9._:@-]{1,120}$").matches(transferId)) { "Invalid transfer ID." }
      require(offset >= 0 && offset < totalBytes) { "Invalid resume offset." }
      val partial = File(partialDirectory, "${safe(transferId)}.part")
      require(offset == 0.0 || (partial.exists() && partial.length() == offset.toLong())) { "The saved partial file does not match the resume offset." }
      if (offset == 0.0 && partial.exists()) partial.delete()
      allowances[peerId] = Allowance(transferId, totalBytes.toLong(), offset.toLong())
    }

    Function("clearIncoming") { peerId: String -> allowances.remove(peerId) }

    Function("partialBytes") { transferId: String ->
      File(partialDirectory, "${safe(transferId)}.part").let { if (it.exists()) it.length().toDouble() else 0.0 }
    }

    Function("deletePartial") { transferId: String ->
      File(partialDirectory, "${safe(transferId)}.part").delete()
      File(incomingDirectory, "${safe(transferId)}.pavo-module").delete()
    }

    Function("startForegroundTransfer") { title: String, text: String ->
      PavoTransferService.onCancel = { sendEvent("onNotificationCancel", mapOf<String, Any>()) }
      val intent = Intent(context, PavoTransferService::class.java)
        .putExtra(PavoTransferService.EXTRA_TITLE, title)
        .putExtra(PavoTransferService.EXTRA_TEXT, text)
      try {
        ContextCompat.startForegroundService(context, intent)
        true
      } catch (_: Exception) {
        false
      }
    }

    Function("updateForegroundTransfer") { text: String, percent: Int ->
      PavoTransferService.update(context, text, percent)
    }

    Function("stopForegroundTransfer") {
      context.stopService(Intent(context, PavoTransferService::class.java))
    }

    OnDestroy {
      client.stopAllEndpoints()
      client.stopAdvertising()
      client.stopDiscovery()
      context.stopService(Intent(context, PavoTransferService::class.java))
    }
  }

  private val discovery = object : EndpointDiscoveryCallback() {
    override fun onEndpointFound(endpointId: String, info: DiscoveredEndpointInfo) {
      peers[endpointId] = info.endpointName
      emitPeers()
    }

    override fun onEndpointLost(endpointId: String) {
      peers.remove(endpointId)
      emitPeers()
    }
  }

  private val lifecycle = object : ConnectionLifecycleCallback() {
    override fun onConnectionInitiated(endpointId: String, info: ConnectionInfo) {
      peers[endpointId] = info.endpointName
      pendingConnections.add(endpointId)
      sendEvent(
        "onVerificationCode",
        mapOf(
          "peerId" to endpointId,
          "peerName" to info.endpointName,
          "code" to info.authenticationDigits,
          "incoming" to info.isIncomingConnection
        )
      )
    }

    override fun onConnectionResult(endpointId: String, result: ConnectionResolution) {
      pendingConnections.remove(endpointId)
      val connected = result.status.isSuccess
      if (connected) {
        connectedPeers.add(endpointId)
        // Point-to-point: stop searching so discovery does not slow the transfer.
        client.stopDiscovery()
        client.stopAdvertising()
      }
      sendEvent(
        "onConnectionStateChanged",
        mapOf(
          "peerId" to endpointId,
          "state" to if (connected) "connected" else "rejected",
          "errorMessage" to if (connected) null else result.status.statusMessage
        )
      )
    }

    override fun onDisconnected(endpointId: String) {
      connectedPeers.remove(endpointId)
      sendEvent("onConnectionStateChanged", mapOf("peerId" to endpointId, "state" to "disconnected"))
    }
  }

  private val payloads = object : PayloadCallback() {
    override fun onPayloadReceived(endpointId: String, payload: Payload) {
      when (payload.type) {
        Payload.Type.BYTES -> {
          val bytes = payload.asBytes() ?: return
          if (bytes.size <= maxTextBytes) {
            sendEvent("onTextReceived", mapOf("peerId" to endpointId, "text" to bytes.toString(Charsets.UTF_8)))
          }
        }
        Payload.Type.FILE -> {
          val allowance = allowances.remove(endpointId)
          if (allowance == null) {
            client.cancelPayload(payload.id)
            payload.close()
            sendEvent("onUnsolicitedFile", mapOf("peerId" to endpointId))
            return
          }
          incoming[payload.id] = Incoming(endpointId, allowance, payload)
        }
        else -> client.cancelPayload(payload.id)
      }
    }

    override fun onPayloadTransferUpdate(endpointId: String, update: PayloadTransferUpdate) {
      outgoing[update.payloadId]?.let { transfer ->
        val status = statusName(update.status)
        sendEvent(
          "onTransferProgress",
          mapOf(
            "payloadId" to update.payloadId.toString(),
            "peerId" to endpointId,
            "direction" to "outgoing",
            "status" to status,
            "bytesTransferred" to (transfer.offset + update.bytesTransferred).coerceAtMost(transfer.totalBytes).toDouble(),
            "totalBytes" to transfer.totalBytes.toDouble()
          )
        )
        if (status != "in_progress") outgoing.remove(update.payloadId)
        return
      }
      val receiving = incoming[update.payloadId] ?: return
      val status = statusName(update.status)
      sendEvent(
        "onTransferProgress",
        mapOf(
          "payloadId" to update.payloadId.toString(),
          "peerId" to endpointId,
          "direction" to "incoming",
          "status" to status,
          "transferId" to receiving.allowance.transferId,
          "bytesTransferred" to (receiving.allowance.offset + update.bytesTransferred).toDouble(),
          "totalBytes" to receiving.allowance.totalBytes.toDouble()
        )
      )
      when (update.status) {
        PayloadTransferUpdate.Status.SUCCESS -> finishIncoming(update.payloadId, receiving)
        PayloadTransferUpdate.Status.FAILURE, PayloadTransferUpdate.Status.CANCELED -> keepPartial(update, receiving)
        else -> Unit
      }
    }
  }

  private fun finishIncoming(payloadId: Long, receiving: Incoming) {
    incoming.remove(payloadId)
    val allowance = receiving.allowance
    val target = File(incomingDirectory, "${safe(allowance.transferId)}.pavo-module")
    val partial = File(partialDirectory, "${safe(allowance.transferId)}.part")
    try {
      FileOutputStream(target).use { output ->
        if (allowance.offset > 0) FileInputStream(partial).use { it.copyTo(output) }
        openPayload(receiving.payload)?.use { input -> copyAtMost(input, output, allowance.totalBytes - allowance.offset) }
          ?: throw IllegalStateException("The received file could not be opened.")
      }
      partial.delete()
      deletePayloadFile(receiving.payload)
      if (target.length() != allowance.totalBytes) {
        target.delete()
        throw IllegalStateException("The received file has the wrong size.")
      }
      sendEvent(
        "onFileReceived",
        mapOf(
          "transferId" to allowance.transferId,
          "peerId" to receiving.peerId,
          "fileUri" to Uri.fromFile(target).toString(),
          "sizeBytes" to target.length().toDouble(),
          "sha256" to sha256(target)
        )
      )
    } catch (error: Exception) {
      sendEvent(
        "onTransferProgress",
        mapOf(
          "payloadId" to payloadId.toString(),
          "peerId" to receiving.peerId,
          "direction" to "incoming",
          "status" to "failure",
          "transferId" to allowance.transferId,
          "bytesTransferred" to 0.0,
          "totalBytes" to allowance.totalBytes.toDouble(),
          "errorMessage" to (error.message ?: "The received file could not be saved.")
        )
      )
    } finally {
      receiving.payload.close()
    }
  }

  /** Keeps the bytes received so far in private storage so the sender can resume. */
  private fun keepPartial(update: PayloadTransferUpdate, receiving: Incoming) {
    incoming.remove(update.payloadId)
    val allowance = receiving.allowance
    val partial = File(partialDirectory, "${safe(allowance.transferId)}.part")
    try {
      val received = update.bytesTransferred.coerceAtMost(allowance.totalBytes - allowance.offset)
      if (received > 0) {
        FileOutputStream(partial, allowance.offset > 0).use { output ->
          openPayload(receiving.payload)?.use { input -> copyAtMost(input, output, received) }
        }
      }
    } catch (_: Exception) {
      partial.delete()
    } finally {
      deletePayloadFile(receiving.payload)
      receiving.payload.close()
    }
    sendEvent(
      "onIncomingInterrupted",
      mapOf("transferId" to allowance.transferId, "partialBytes" to (if (partial.exists()) partial.length() else 0L).toDouble())
    )
  }

  private fun openPayload(payload: Payload): InputStream? {
    val file = payload.asFile() ?: return null
    file.asUri()?.let { return context.contentResolver.openInputStream(it) }
    @Suppress("DEPRECATION")
    return file.asJavaFile()?.let { FileInputStream(it) }
  }

  private fun deletePayloadFile(payload: Payload) {
    try {
      payload.asFile()?.asUri()?.let { context.contentResolver.delete(it, null, null) }
    } catch (_: Exception) {
      // The system cleans up Nearby's temporary download if this fails.
    }
  }

  private fun copyAtMost(input: InputStream, output: FileOutputStream, limit: Long) {
    val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
    var remaining = limit
    while (remaining > 0) {
      val read = input.read(buffer, 0, minOf(buffer.size.toLong(), remaining).toInt())
      if (read < 0) break
      output.write(buffer, 0, read)
      remaining -= read
    }
  }

  private fun statusName(status: Int) = when (status) {
    PayloadTransferUpdate.Status.IN_PROGRESS -> "in_progress"
    PayloadTransferUpdate.Status.SUCCESS -> "success"
    PayloadTransferUpdate.Status.CANCELED -> "canceled"
    else -> "failure"
  }

  private fun emitPeers() {
    sendEvent("onPeersChanged", mapOf("peers" to peers.map { (id, name) -> mapOf("id" to id, "name" to name) }))
  }

  private fun requiredPermissions(): Array<String> {
    val notifications = if (Build.VERSION.SDK_INT >= 33) arrayOf(Manifest.permission.POST_NOTIFICATIONS) else emptyArray()
    val radios = when {
      Build.VERSION.SDK_INT >= 37 -> arrayOf(
        Manifest.permission.BLUETOOTH_ADVERTISE,
        Manifest.permission.BLUETOOTH_CONNECT,
        Manifest.permission.BLUETOOTH_SCAN,
        Manifest.permission.NEARBY_WIFI_DEVICES,
        "android.permission.ACCESS_LOCAL_NETWORK"
      )
      Build.VERSION.SDK_INT >= 32 -> arrayOf(
        Manifest.permission.BLUETOOTH_ADVERTISE,
        Manifest.permission.BLUETOOTH_CONNECT,
        Manifest.permission.BLUETOOTH_SCAN,
        Manifest.permission.NEARBY_WIFI_DEVICES
      )
      Build.VERSION.SDK_INT >= 31 -> arrayOf(
        Manifest.permission.BLUETOOTH_ADVERTISE,
        Manifest.permission.BLUETOOTH_CONNECT,
        Manifest.permission.BLUETOOTH_SCAN,
        Manifest.permission.ACCESS_FINE_LOCATION
      )
      Build.VERSION.SDK_INT >= 29 -> arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
      else -> arrayOf(Manifest.permission.ACCESS_COARSE_LOCATION)
    }
    return radios + notifications
  }

  private fun fileFromUri(rawUri: String): File {
    val uri = Uri.parse(rawUri)
    if (uri.scheme == null || uri.scheme == "file") return File(requireNotNull(uri.path) { "File URI has no path." })
    val target = File.createTempFile("pavo-send-", ".pavo-module", context.cacheDir)
    context.contentResolver.openInputStream(uri).use { input ->
      requireNotNull(input) { "Selected file could not be opened." }
      FileOutputStream(target).use { output -> input.copyTo(output) }
    }
    return target
  }

  private fun sha256(file: File): String {
    val digest = MessageDigest.getInstance("SHA-256")
    FileInputStream(file).use { input ->
      val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
      while (true) {
        val count = input.read(buffer)
        if (count < 0) break
        digest.update(buffer, 0, count)
      }
    }
    return digest.digest().joinToString("") { "%02x".format(it) }
  }

  private fun safe(value: String) = value.replace(Regex("[^A-Za-z0-9._-]"), "_")
}

private data class Allowance(val transferId: String, val totalBytes: Long, val offset: Long)

private data class Incoming(val peerId: String, val allowance: Allowance, val payload: Payload)

private data class Outgoing(val peerId: String, val totalBytes: Long, val offset: Long)
