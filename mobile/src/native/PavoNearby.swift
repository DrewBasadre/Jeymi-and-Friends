import CryptoKit
public import ExpoModulesCore
import Foundation
import NearbyConnections

public final class PavoNearby: Module {
  private let connectionManager = ConnectionManager(
    serviceID: "org.pavo.learninghub",
    strategy: .cluster
  )
  private lazy var advertiser = Advertiser(connectionManager: connectionManager)
  private lazy var discoverer = Discoverer(connectionManager: connectionManager)
  private var displayName = "PAVO Device"
  private var peers: [EndpointID: String] = [:]
  private var connectedPeers = Set<EndpointID>()
  private var verificationHandlers: [EndpointID: (Bool) -> Void] = [:]
  private var cancellationTokens: [String: CancellationToken] = [:]
  private var metadataByPayload: [PayloadID: TransferMetadata] = [:]
  private var incomingResources: [PayloadID: IncomingResource] = [:]
  private var successfulPayloads = Set<PayloadID>()
  private var metadataPayloads = Set<PayloadID>()

  public func definition() -> ModuleDefinition {
    Name("PavoNearby")

    Events(
      "onPeersChanged",
      "onVerificationCode",
      "onConnectionStateChanged",
      "onTransferUpdate",
      "onFileReceived"
    )

    OnCreate {
      self.connectionManager.delegate = self
      self.advertiser.delegate = self
      self.discoverer.delegate = self
    }

    Function("isAvailable") {
      true
    }

    AsyncFunction("requestPermissions") {
      // iOS presents Bluetooth and local-network prompts when Nearby starts.
    }

    AsyncFunction("startAdvertising") {
      (displayName: String, promise: Promise) in
      self.displayName = String(displayName.prefix(32))
      guard let context = self.displayName.data(using: .utf8) else {
        promise.reject("E_ADVERTISE", "The device name is invalid.")
        return
      }
      self.advertiser.startAdvertising(using: context) { error in
        if let error {
          promise.reject("E_ADVERTISE", error.localizedDescription)
        } else {
          promise.resolve()
        }
      }
    }

    AsyncFunction("stopAdvertising") { (promise: Promise) in
      self.advertiser.stopAdvertising { error in
        if let error {
          promise.reject("E_ADVERTISE", error.localizedDescription)
        } else {
          promise.resolve()
        }
      }
    }

    AsyncFunction("startDiscovery") { (promise: Promise) in
      self.discoverer.startDiscovery { error in
        if let error {
          promise.reject("E_DISCOVERY", error.localizedDescription)
        } else {
          promise.resolve()
        }
      }
    }

    AsyncFunction("stopDiscovery") { (promise: Promise) in
      self.discoverer.stopDiscovery { error in
        if let error {
          promise.reject("E_DISCOVERY", error.localizedDescription)
        } else {
          promise.resolve()
        }
      }
    }

    AsyncFunction("requestConnection") {
      (peerID: String, promise: Promise) in
      guard let context = self.displayName.data(using: .utf8) else {
        promise.reject("E_CONNECTION", "The device name is invalid.")
        return
      }
      self.discoverer.requestConnection(to: peerID, using: context) { error in
        if let error {
          promise.reject("E_CONNECTION", error.localizedDescription)
        } else {
          promise.resolve()
        }
      }
    }

    AsyncFunction("acceptConnection") {
      (peerID: String, accept: Bool, promise: Promise) in
      guard let handler = self.verificationHandlers.removeValue(forKey: peerID) else {
        promise.reject("E_CONNECTION", "No pending connection for this peer.")
        return
      }
      handler(accept)
      promise.resolve()
    }

    AsyncFunction("sendFile") {
      (
        peerID: String,
        metadataJSON: String,
        fileURI: String,
        promise: Promise
      ) in
      guard self.connectedPeers.contains(peerID) else {
        promise.reject("E_NOT_CONNECTED", "Connect and verify this peer first.")
        return
      }
      guard let fileURL = URL(string: fileURI), fileURL.isFileURL else {
        promise.reject("E_FILE", "The selected file URI is invalid.")
        return
      }
      do {
        let payloadID = PayloadID.unique()
        let transferID = String(payloadID)
        var metadata = try self.metadataDictionary(from: metadataJSON)
        metadata["payloadId"] = payloadID
        metadata["transferId"] = transferID
        let fileName = self.safeFileName(
          metadata["displayName"] as? String ?? fileURL.lastPathComponent
        )
        metadata["fileName"] = fileName
        let metadataData = try JSONSerialization.data(withJSONObject: metadata)
        let metadataPayloadID = PayloadID.unique()
        self.metadataPayloads.insert(metadataPayloadID)
        _ = self.connectionManager.send(
          metadataData,
          to: [peerID],
          id: metadataPayloadID
        )
        let token = self.connectionManager.sendResource(
          at: fileURL,
          withName: fileName,
          to: [peerID],
          id: payloadID
        ) { error in
          if let error {
            self.cancellationTokens.removeValue(forKey: transferID)
            promise.reject("E_TRANSFER", error.localizedDescription)
          } else {
            self.sendTransferUpdate(
              transferID: transferID,
              status: "queued",
              completed: 0,
              total: self.fileSize(fileURL),
              errorMessage: nil
            )
            promise.resolve(transferID)
          }
        }
        self.cancellationTokens[transferID] = token
      } catch {
        promise.reject("E_FILE", error.localizedDescription)
      }
    }

    AsyncFunction("cancelTransfer") {
      (transferID: String, promise: Promise) in
      guard let token = self.cancellationTokens.removeValue(forKey: transferID) else {
        promise.reject("E_TRANSFER", "Unknown transfer ID.")
        return
      }
      token.cancel { error in
        if let error {
          promise.reject("E_TRANSFER", error.localizedDescription)
        } else {
          promise.resolve()
        }
      }
    }

    OnDestroy {
      self.advertiser.stopAdvertising()
      self.discoverer.stopDiscovery()
      self.connectedPeers.forEach {
        self.connectionManager.disconnect(from: $0)
      }
      self.verificationHandlers.values.forEach { $0(false) }
      self.verificationHandlers.removeAll()
      self.cancellationTokens.values.forEach { $0.cancel() }
      self.cancellationTokens.removeAll()
      self.metadataPayloads.removeAll()
    }
  }

  private func emitPeers() {
    sendEvent(
      "onPeersChanged",
      [
        "peers": peers.map { peerID, name in
          [
            "id": peerID,
            "name": name,
            "connected": connectedPeers.contains(peerID),
          ] as [String: Any]
        }
      ]
    )
  }

  private func metadataDictionary(from raw: String) throws -> [String: Any] {
    guard
      let data = raw.data(using: .utf8),
      let value = try JSONSerialization.jsonObject(with: data) as? [String: Any]
    else {
      throw NearbyModuleError.invalidMetadata
    }
    return value
  }

  private func finishIncomingIfReady(payloadID: PayloadID) {
    guard
      successfulPayloads.contains(payloadID),
      let incoming = incomingResources[payloadID],
      let metadata = metadataByPayload[payloadID]
    else {
      return
    }
    defer {
      successfulPayloads.remove(payloadID)
      incomingResources.removeValue(forKey: payloadID)
      metadataByPayload.removeValue(forKey: payloadID)
    }
    do {
      let directory = try moduleDirectory()
      let target = uniqueTarget(
        directory: directory,
        fileName: safeFileName(metadata.fileName)
      )
      try FileManager.default.copyItem(at: incoming.localURL, to: target)
      let actualHash = try sha256(target)
      if !metadata.sha256.isEmpty && metadata.sha256 != actualHash {
        try? FileManager.default.removeItem(at: target)
        sendTransferUpdate(
          transferID: metadata.transferID,
          status: "failed",
          completed: 0,
          total: metadata.sizeBytes,
          errorMessage: "Checksum verification failed."
        )
        return
      }
      sendEvent(
        "onFileReceived",
        [
          "transferId": metadata.transferID,
          "peerId": incoming.endpointID,
          "moduleId": metadata.moduleID,
          "displayName": metadata.displayName,
          "fileUri": target.absoluteString,
          "mimeType": metadata.mimeType,
          "sizeBytes": fileSize(target),
          "sha256": actualHash,
          "manifestJson": metadata.manifestJSON,
        ]
      )
    } catch {
      sendTransferUpdate(
        transferID: metadata.transferID,
        status: "failed",
        completed: 0,
        total: metadata.sizeBytes,
        errorMessage: error.localizedDescription
      )
    }
  }

  private func receiveMetadata(_ data: Data) {
    guard
      let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
      let payloadNumber = object["payloadId"] as? NSNumber
    else {
      return
    }
    let payloadID = payloadNumber.int64Value
    metadataByPayload[payloadID] = TransferMetadata(
      transferID: object["transferId"] as? String ?? String(payloadID),
      moduleID: object["moduleId"] as? String ?? "",
      displayName: object["displayName"] as? String ?? "PAVO module",
      fileName: object["fileName"] as? String ?? "pavo-module.pavo-module",
      mimeType: object["mimeType"] as? String ?? "application/vnd.pavo.module+zip",
      sizeBytes: (object["sizeBytes"] as? NSNumber)?.int64Value ?? 0,
      sha256: (object["sha256"] as? String ?? "").lowercased(),
      manifestJSON: jsonString(object["manifest"])
    )
    finishIncomingIfReady(payloadID: payloadID)
  }

  private func jsonString(_ value: Any?) -> String {
    guard
      let value,
      JSONSerialization.isValidJSONObject(value),
      let data = try? JSONSerialization.data(withJSONObject: value),
      let result = String(data: data, encoding: .utf8)
    else {
      return "{}"
    }
    return result
  }

  private func sendTransferUpdate(
    transferID: String,
    status: String,
    completed: Int64,
    total: Int64,
    errorMessage: String?
  ) {
    sendEvent(
      "onTransferUpdate",
      [
        "transferId": transferID,
        "status": status,
        "bytesTransferred": completed,
        "totalBytes": total,
        "errorMessage": errorMessage as Any,
      ]
    )
  }

  private func safeFileName(_ value: String) -> String {
    let allowed = CharacterSet.alphanumerics.union(
      CharacterSet(charactersIn: "._ -")
    )
    let cleaned = value.unicodeScalars
      .map { allowed.contains($0) ? Character(String($0)) : "_" }
      .reduce(into: "") { $0.append($1) }
      .trimmingCharacters(in: .whitespacesAndNewlines)
    let limited = String(cleaned.prefix(100))
    if limited.lowercased().hasSuffix(".pavo-module") {
      return limited
    }
    return limited.isEmpty
      ? "pavo-module.pavo-module"
      : "\(limited).pavo-module"
  }

  private func moduleDirectory() throws -> URL {
    let base = try FileManager.default.url(
      for: .documentDirectory,
      in: .userDomainMask,
      appropriateFor: nil,
      create: true
    )
    let directory = base.appendingPathComponent(
      "pavo-modules",
      isDirectory: true
    )
    try FileManager.default.createDirectory(
      at: directory,
      withIntermediateDirectories: true
    )
    return directory
  }

  private func uniqueTarget(directory: URL, fileName: String) -> URL {
    let first = directory.appendingPathComponent(fileName)
    if !FileManager.default.fileExists(atPath: first.path) {
      return first
    }
    let stem = (fileName as NSString).deletingPathExtension
    var suffix = 2
    while true {
      let candidate = directory.appendingPathComponent(
        "\(stem)-\(suffix).pavo-module"
      )
      if !FileManager.default.fileExists(atPath: candidate.path) {
        return candidate
      }
      suffix += 1
    }
  }

  private func fileSize(_ url: URL) -> Int64 {
    let values = try? url.resourceValues(forKeys: [.fileSizeKey])
    return Int64(values?.fileSize ?? 0)
  }

  private func sha256(_ url: URL) throws -> String {
    let handle = try FileHandle(forReadingFrom: url)
    defer { try? handle.close() }
    var hasher = SHA256()
    while let data = try handle.read(upToCount: 64 * 1024), !data.isEmpty {
      hasher.update(data: data)
    }
    return hasher.finalize().map { String(format: "%02x", $0) }.joined()
  }
}

extension PavoNearby: DiscovererDelegate {
  public func discoverer(
    _ discoverer: Discoverer,
    didFind endpointID: EndpointID,
    with context: Data
  ) {
    peers[endpointID] = String(data: context, encoding: .utf8) ?? "PAVO Device"
    emitPeers()
  }

  public func discoverer(_ discoverer: Discoverer, didLose endpointID: EndpointID) {
    peers.removeValue(forKey: endpointID)
    connectedPeers.remove(endpointID)
    emitPeers()
  }
}

extension PavoNearby: AdvertiserDelegate {
  public func advertiser(
    _ advertiser: Advertiser,
    didReceiveConnectionRequestFrom endpointID: EndpointID,
    with context: Data,
    connectionRequestHandler: @escaping (Bool) -> Void
  ) {
    peers[endpointID] = String(data: context, encoding: .utf8) ?? "PAVO Device"
    emitPeers()
    connectionRequestHandler(true)
  }
}

extension PavoNearby: ConnectionManagerDelegate {
  public func connectionManager(
    _ connectionManager: ConnectionManager,
    didReceive verificationCode: String,
    from endpointID: EndpointID,
    verificationHandler: @escaping (Bool) -> Void
  ) {
    verificationHandlers[endpointID] = verificationHandler
    sendEvent(
      "onVerificationCode",
      [
        "peerId": endpointID,
        "peerName": peers[endpointID] ?? "PAVO Device",
        "code": verificationCode,
      ]
    )
  }

  public func connectionManager(
    _ connectionManager: ConnectionManager,
    didReceive data: Data,
    withID payloadID: PayloadID,
    from endpointID: EndpointID
  ) {
    metadataPayloads.insert(payloadID)
    receiveMetadata(data)
  }

  public func connectionManager(
    _ connectionManager: ConnectionManager,
    didReceive stream: InputStream,
    withID payloadID: PayloadID,
    from endpointID: EndpointID,
    cancellationToken token: CancellationToken
  ) {
    token.cancel()
  }

  public func connectionManager(
    _ connectionManager: ConnectionManager,
    didStartReceivingResourceWithID payloadID: PayloadID,
    from endpointID: EndpointID,
    at localURL: URL,
    withName name: String,
    cancellationToken token: CancellationToken
  ) {
    incomingResources[payloadID] = IncomingResource(
      endpointID: endpointID,
      localURL: localURL
    )
    cancellationTokens[String(payloadID)] = token
    finishIncomingIfReady(payloadID: payloadID)
  }

  public func connectionManager(
    _ connectionManager: ConnectionManager,
    didReceiveTransferUpdate update: TransferUpdate,
    from endpointID: EndpointID,
    forPayload payloadID: PayloadID
  ) {
    if metadataPayloads.contains(payloadID) {
      switch update {
      case .success, .canceled, .failure:
        metadataPayloads.remove(payloadID)
      case .progress:
        break
      }
      return
    }
    let transferID = String(payloadID)
    switch update {
    case .success:
      successfulPayloads.insert(payloadID)
      sendTransferUpdate(
        transferID: transferID,
        status: "complete",
        completed: 0,
        total: 0,
        errorMessage: nil
      )
      finishIncomingIfReady(payloadID: payloadID)
      cancellationTokens.removeValue(forKey: transferID)
    case .canceled:
      sendTransferUpdate(
        transferID: transferID,
        status: "cancelled",
        completed: 0,
        total: 0,
        errorMessage: nil
      )
      cancellationTokens.removeValue(forKey: transferID)
    case .failure:
      sendTransferUpdate(
        transferID: transferID,
        status: "failed",
        completed: 0,
        total: 0,
        errorMessage: "Nearby transfer failed."
      )
      cancellationTokens.removeValue(forKey: transferID)
    case .progress(let progress):
      sendTransferUpdate(
        transferID: transferID,
        status: "transferring",
        completed: progress.completedUnitCount,
        total: progress.totalUnitCount,
        errorMessage: nil
      )
    }
  }

  public func connectionManager(
    _ connectionManager: ConnectionManager,
    didChangeTo state: ConnectionState,
    for endpointID: EndpointID
  ) {
    let stateValue: String
    switch state {
    case .connecting:
      stateValue = "connecting"
    case .connected:
      connectedPeers.insert(endpointID)
      stateValue = "connected"
    case .disconnected:
      connectedPeers.remove(endpointID)
      stateValue = "disconnected"
    case .rejected:
      connectedPeers.remove(endpointID)
      stateValue = "rejected"
    }
    emitPeers()
    sendEvent(
      "onConnectionStateChanged",
      ["peerId": endpointID, "state": stateValue]
    )
  }
}

private struct TransferMetadata {
  let transferID: String
  let moduleID: String
  let displayName: String
  let fileName: String
  let mimeType: String
  let sizeBytes: Int64
  let sha256: String
  let manifestJSON: String
}

private struct IncomingResource {
  let endpointID: EndpointID
  let localURL: URL
}

private enum NearbyModuleError: LocalizedError {
  case invalidMetadata

  var errorDescription: String? {
    "Transfer metadata must be a JSON object."
  }
}
