package org.pavo.nearby

import android.Manifest
import android.net.Uri
import android.os.Build
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
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.security.MessageDigest
import java.util.Locale
import kotlin.math.max

class PavoNearbyModule : Module() {
  private val serviceId = "org.pavo.learninghub"
  private val strategy = Strategy.P2P_POINT_TO_POINT
  private val peers = linkedMapOf<String, String>()
  private val connectedPeers = mutableSetOf<String>()
  private val pendingConnections = mutableSetOf<String>()
  private val incomingFiles = mutableMapOf<Long, Payload>()
  private val incomingEndpoints = mutableMapOf<Long, String>()
  private val successfulIncomingPayloads = mutableSetOf<Long>()
  private val metadataByPayload = mutableMapOf<Long, TransferMetadata>()
  private val metadataPayloads = mutableSetOf<Long>()
  private val outboundTransfers = mutableMapOf<String, OutboundTransfer>()

  private val context
    get() = requireNotNull(appContext.reactContext)

  private val client
    get() = Nearby.getConnectionsClient(context)

  private val permissionsManager: Permissions
    get() = appContext.permissions ?: throw Exceptions.PermissionsModuleNotFound()

  override fun definition() = ModuleDefinition {
    Name("PavoNearby")

    Events(
      "onPeersChanged",
      "onVerificationCode",
      "onConnectionStateChanged",
      "onTransferUpdate",
      "onFileReceived"
    )

    Function("isAvailable") {
      true
    }

    AsyncFunction("requestPermissions") { promise: Promise ->
      Permissions.askForPermissionsWithPermissionsManager(
        permissionsManager,
        promise,
        *requiredPermissions()
      )
    }

    AsyncFunction("startAdvertising") { displayName: String, promise: Promise ->
      client.startAdvertising(
        displayName.take(32),
        serviceId,
        connectionLifecycleCallback,
        AdvertisingOptions.Builder().setStrategy(strategy).build()
      ).addOnSuccessListener {
        promise.resolve()
      }.addOnFailureListener { error ->
        promise.reject("E_ADVERTISE", error.message, error)
      }
    }

    AsyncFunction("stopAdvertising") { promise: Promise ->
      client.stopAdvertising()
      promise.resolve()
    }

    AsyncFunction("startDiscovery") { promise: Promise ->
      client.startDiscovery(
        serviceId,
        endpointDiscoveryCallback,
        DiscoveryOptions.Builder().setStrategy(strategy).build()
      ).addOnSuccessListener {
        promise.resolve()
      }.addOnFailureListener { error ->
        promise.reject("E_DISCOVERY", error.message, error)
      }
    }

    AsyncFunction("stopDiscovery") { promise: Promise ->
      client.stopDiscovery()
      promise.resolve()
    }

    AsyncFunction("requestConnection") { peerId: String, promise: Promise ->
      val localName = Build.MODEL.take(32)
      client.requestConnection(localName, peerId, connectionLifecycleCallback)
        .addOnSuccessListener {
          promise.resolve()
        }.addOnFailureListener { error ->
          promise.reject("E_CONNECTION", error.message, error)
        }
    }

    AsyncFunction("acceptConnection") { peerId: String, accept: Boolean, promise: Promise ->
      if (!pendingConnections.remove(peerId)) {
        promise.reject("E_CONNECTION", "No pending connection for this peer.", null)
        return@AsyncFunction
      }
      val task = if (accept) {
        client.acceptConnection(peerId, payloadCallback)
      } else {
        client.rejectConnection(peerId)
      }
      task.addOnSuccessListener {
        promise.resolve()
      }.addOnFailureListener { error ->
        promise.reject("E_CONNECTION", error.message, error)
      }
    }

    AsyncFunction("sendFile") {
        peerId: String,
        metadataJson: String,
        fileUri: String,
        promise: Promise ->
      if (!connectedPeers.contains(peerId)) {
        promise.reject("E_NOT_CONNECTED", "Connect and verify this peer first.", null)
        return@AsyncFunction
      }
      try {
        val source = fileFromUri(fileUri)
        val filePayload = Payload.fromFile(source).apply {
          setFileName(safeFileName(JSONObject(metadataJson).optString("displayName", source.name)))
          setSensitive(true)
        }
        val transferId = filePayload.id.toString()
        val metadata = JSONObject(metadataJson).apply {
          put("payloadId", filePayload.id)
          put("transferId", transferId)
          put("fileName", safeFileName(optString("displayName", source.name)))
        }
        val transfer = OutboundTransfer(
          peerId = peerId,
          metadata = metadata,
          payload = filePayload,
          totalBytes = source.length()
        )
        outboundTransfers[transferId] = transfer
        sendOutboundTransfer(transferId, transfer, promise)
      } catch (error: Exception) {
        promise.reject("E_FILE", error.message, error)
      }
    }

    AsyncFunction("retryTransfer") { transferId: String, promise: Promise ->
      val transfer = outboundTransfers[transferId]
      if (transfer == null) {
        promise.reject("E_TRANSFER", "This transfer can no longer be resumed.", null)
        return@AsyncFunction
      }
      if (!connectedPeers.contains(transfer.peerId)) {
        promise.reject("E_NOT_CONNECTED", "Reconnect to the student device before resuming.", null)
        return@AsyncFunction
      }
      transfer.payload.setOffset(transfer.resumeOffset)
      sendOutboundTransfer(transferId, transfer, promise)
    }

    AsyncFunction("cancelTransfer") { transferId: String, promise: Promise ->
      val payloadId = outboundTransfers[transferId]?.payload?.id ?: transferId.toLongOrNull()
      if (payloadId == null) {
        promise.reject("E_TRANSFER", "Unknown transfer ID.", null)
        return@AsyncFunction
      }
      client.cancelPayload(payloadId).addOnSuccessListener {
        promise.resolve()
      }.addOnFailureListener { error ->
        promise.reject("E_TRANSFER", error.message, error)
      }
    }

    OnDestroy {
      client.stopAllEndpoints()
      client.stopAdvertising()
      client.stopDiscovery()
      peers.clear()
      connectedPeers.clear()
      pendingConnections.clear()
      incomingFiles.clear()
      incomingEndpoints.clear()
      successfulIncomingPayloads.clear()
      metadataByPayload.clear()
      metadataPayloads.clear()
      outboundTransfers.values.forEach { it.payload.close() }
      outboundTransfers.clear()
    }
  }

  private val endpointDiscoveryCallback = object : EndpointDiscoveryCallback() {
    override fun onEndpointFound(endpointId: String, info: DiscoveredEndpointInfo) {
      peers[endpointId] = info.endpointName
      emitPeers()
    }

    override fun onEndpointLost(endpointId: String) {
      peers.remove(endpointId)
      connectedPeers.remove(endpointId)
      emitPeers()
    }
  }

  private val connectionLifecycleCallback = object : ConnectionLifecycleCallback() {
    override fun onConnectionInitiated(endpointId: String, info: ConnectionInfo) {
      peers[endpointId] = info.endpointName
      pendingConnections.add(endpointId)
      emitPeers()
      sendEvent(
        "onVerificationCode",
        mapOf(
          "peerId" to endpointId,
          "peerName" to info.endpointName,
          "code" to info.authenticationDigits
        )
      )
    }

    override fun onConnectionResult(endpointId: String, result: ConnectionResolution) {
      pendingConnections.remove(endpointId)
      val connected = result.status.isSuccess
      if (connected) connectedPeers.add(endpointId) else connectedPeers.remove(endpointId)
      sendEvent(
        "onConnectionStateChanged",
        mapOf(
          "peerId" to endpointId,
          "state" to if (connected) "connected" else "failed",
          "errorMessage" to if (connected) null else result.status.statusMessage
        )
      )
    }

    override fun onDisconnected(endpointId: String) {
      connectedPeers.remove(endpointId)
      sendEvent(
        "onConnectionStateChanged",
        mapOf("peerId" to endpointId, "state" to "disconnected")
      )
    }
  }

  private val payloadCallback = object : PayloadCallback() {
    override fun onPayloadReceived(endpointId: String, payload: Payload) {
      when (payload.type) {
        Payload.Type.BYTES -> {
          metadataPayloads.add(payload.id)
          receiveMetadata(payload.asBytes())
        }
        Payload.Type.FILE -> {
          metadataByPayload[payload.id]?.let { metadata ->
            if (metadata.resumeOffset > 0) payload.setOffset(metadata.resumeOffset)
          }
          val previous = incomingFiles.put(payload.id, payload)
          if (previous != null && previous !== payload) previous.close()
          incomingEndpoints[payload.id] = endpointId
          finishIncomingIfReady(endpointId, payload.id)
        }
      }
    }

    override fun onPayloadTransferUpdate(
      endpointId: String,
      update: PayloadTransferUpdate
    ) {
      if (metadataPayloads.contains(update.payloadId)) {
        if (
          update.status == PayloadTransferUpdate.Status.SUCCESS ||
          update.status == PayloadTransferUpdate.Status.FAILURE ||
          update.status == PayloadTransferUpdate.Status.CANCELED
        ) {
          metadataPayloads.remove(update.payloadId)
        }
        return
      }
      val transferId = update.payloadId.toString()
      val status = when (update.status) {
        PayloadTransferUpdate.Status.IN_PROGRESS -> "transferring"
        PayloadTransferUpdate.Status.SUCCESS -> "complete"
        PayloadTransferUpdate.Status.FAILURE -> "failed"
        PayloadTransferUpdate.Status.CANCELED -> "cancelled"
        else -> "queued"
      }
      sendTransferUpdate(
        transferId,
        status,
        update.bytesTransferred,
        update.totalBytes,
        null
      )
      if (update.status == PayloadTransferUpdate.Status.SUCCESS) {
        if (incomingFiles.containsKey(update.payloadId)) {
          successfulIncomingPayloads.add(update.payloadId)
        }
        finishIncomingIfReady(endpointId, update.payloadId)
        outboundTransfers.remove(transferId)?.payload?.close()
      } else if (
        update.status == PayloadTransferUpdate.Status.FAILURE ||
        update.status == PayloadTransferUpdate.Status.CANCELED
      ) {
        // Nearby resumes only when both sides retain the payload and its last offset.
        successfulIncomingPayloads.remove(update.payloadId)
        incomingFiles[update.payloadId]?.let { payload ->
          payload.setOffset(max(payload.offset, update.bytesTransferred))
        }
        outboundTransfers[transferId]?.let { transfer ->
          transfer.resumeOffset = max(
            transfer.resumeOffset,
            max(transfer.payload.offset, update.bytesTransferred)
          ).coerceAtMost(transfer.totalBytes)
          transfer.payload.setOffset(transfer.resumeOffset)
        }
      }
    }
  }

  private fun receiveMetadata(bytes: ByteArray?) {
    if (bytes == null) return
    try {
      val objectValue = JSONObject(bytes.toString(Charsets.UTF_8))
      val payloadId = objectValue.getLong("payloadId")
      metadataByPayload[payloadId] = TransferMetadata(
        transferId = objectValue.optString("transferId", payloadId.toString()),
        moduleId = objectValue.optString("moduleId", ""),
        displayName = objectValue.optString("displayName", "PAVO module"),
        fileName = safeFileName(objectValue.optString("fileName", "pavo-module.pavo-module")),
        mimeType = objectValue.optString("mimeType", "application/vnd.pavo.module+zip"),
        sizeBytes = objectValue.optLong("sizeBytes", 0),
        sha256 = objectValue.optString("sha256", "").lowercase(Locale.US),
        manifestJson = objectValue.optJSONObject("manifest")?.toString() ?: "{}",
        resumeOffset = objectValue.optLong("resumeOffset", 0).coerceAtLeast(0)
      )
      incomingFiles[payloadId]?.let { payload ->
        payload.setOffset(max(payload.offset, metadataByPayload[payloadId]?.resumeOffset ?: 0))
      }
      incomingEndpoints[payloadId]?.let { endpointId ->
        finishIncomingIfReady(endpointId, payloadId)
      }
    } catch (_: Exception) {
      return
    }
  }

  private fun finishIncomingIfReady(endpointId: String, payloadId: Long) {
    if (!successfulIncomingPayloads.contains(payloadId)) return
    val payload = incomingFiles[payloadId] ?: return
    val metadata = metadataByPayload[payloadId] ?: return
    val sourceUri = payload.asFile()?.asUri() ?: return
    try {
      val targetDirectory = File(context.filesDir, "pavo-modules").apply { mkdirs() }
      val target = uniqueTarget(targetDirectory, metadata.fileName)
      context.contentResolver.openInputStream(sourceUri).use { input ->
        requireNotNull(input) { "Received file could not be opened." }
        FileOutputStream(target).use { output -> input.copyTo(output) }
      }
      val actualHash = sha256(target)
      if (metadata.sha256.isNotBlank() && actualHash != metadata.sha256) {
        val receivedSize = target.length()
        target.delete()
        sendTransferUpdate(
          metadata.transferId,
          "failed",
          receivedSize,
          metadata.sizeBytes,
          "Checksum verification failed."
        )
      } else {
        sendEvent(
          "onFileReceived",
          mapOf(
            "transferId" to metadata.transferId,
            "peerId" to endpointId,
            "moduleId" to metadata.moduleId,
            "displayName" to metadata.displayName,
            "fileUri" to Uri.fromFile(target).toString(),
            "mimeType" to metadata.mimeType,
            "sizeBytes" to target.length(),
            "sha256" to actualHash,
            "manifestJson" to metadata.manifestJson
          )
        )
      }
    } catch (error: Exception) {
      sendTransferUpdate(
        metadata.transferId,
        "failed",
        0,
        metadata.sizeBytes,
        error.message
      )
    } finally {
      incomingFiles.remove(payloadId)
      incomingEndpoints.remove(payloadId)
      successfulIncomingPayloads.remove(payloadId)
      metadataByPayload.remove(payloadId)
    }
  }

  private fun emitPeers() {
    sendEvent(
      "onPeersChanged",
      mapOf(
        "peers" to peers.map { (id, name) ->
          mapOf(
            "id" to id,
            "name" to name,
            "connected" to connectedPeers.contains(id)
          )
        }
      )
    )
  }

  private fun sendTransferUpdate(
    transferId: String,
    status: String,
    bytesTransferred: Long,
    totalBytes: Long,
    errorMessage: String?
  ) {
    sendEvent(
      "onTransferUpdate",
      mapOf(
        "transferId" to transferId,
        "status" to status,
        "bytesTransferred" to bytesTransferred,
        "totalBytes" to totalBytes,
        "errorMessage" to errorMessage
      )
    )
  }

  private fun sendOutboundTransfer(
    transferId: String,
    transfer: OutboundTransfer,
    promise: Promise
  ) {
    transfer.metadata.put("resumeOffset", transfer.resumeOffset)
    val metadataPayload = Payload.fromBytes(
      transfer.metadata.toString().toByteArray(Charsets.UTF_8)
    )
    metadataPayloads.add(metadataPayload.id)
    client.sendPayload(transfer.peerId, metadataPayload).addOnSuccessListener {
      client.sendPayload(transfer.peerId, transfer.payload).addOnSuccessListener {
        sendTransferUpdate(
          transferId,
          "queued",
          transfer.resumeOffset,
          transfer.totalBytes,
          null
        )
        promise.resolve(transferId)
      }.addOnFailureListener { error ->
        promise.reject("E_TRANSFER", error.message, error)
      }
    }.addOnFailureListener { error ->
      metadataPayloads.remove(metadataPayload.id)
      promise.reject("E_TRANSFER", error.message, error)
    }
  }

  private fun requiredPermissions(): Array<String> {
    return when {
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
  }

  private fun fileFromUri(rawUri: String): File {
    val uri = Uri.parse(rawUri)
    if (uri.scheme == null || uri.scheme == "file") {
      return File(requireNotNull(uri.path) { "File URI has no path." })
    }
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

  private fun safeFileName(value: String): String {
    val cleaned = value
      .replace(Regex("[^A-Za-z0-9._ -]"), "_")
      .trim()
      .take(100)
    val withExtension = if (cleaned.lowercase(Locale.US).endsWith(".pavo-module")) {
      cleaned
    } else {
      "$cleaned.pavo-module"
    }
    return withExtension.ifBlank { "pavo-module.pavo-module" }
  }

  private fun uniqueTarget(directory: File, fileName: String): File {
    val first = File(directory, fileName)
    if (!first.exists()) return first
    val stem = fileName.removeSuffix(".pavo-module")
    var suffix = 2
    while (true) {
      val candidate = File(directory, "$stem-$suffix.pavo-module")
      if (!candidate.exists()) return candidate
      suffix += 1
    }
  }
}

private data class TransferMetadata(
  val transferId: String,
  val moduleId: String,
  val displayName: String,
  val fileName: String,
  val mimeType: String,
  val sizeBytes: Long,
  val sha256: String,
  val manifestJson: String,
  val resumeOffset: Long
)

private data class OutboundTransfer(
  val peerId: String,
  val metadata: JSONObject,
  val payload: Payload,
  val totalBytes: Long,
  var resumeOffset: Long = 0
)
