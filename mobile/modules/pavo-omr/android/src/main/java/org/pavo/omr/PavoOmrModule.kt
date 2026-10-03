package org.pavo.omr

import android.net.Uri
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.opencv.android.OpenCVLoader
import org.opencv.core.MatOfInt
import org.opencv.imgcodecs.Imgcodecs
import java.io.File
import java.util.UUID

/**
 * On-device answer-sheet scanning. Photos never leave the device: the image is
 * read from app storage, measured with OpenCV, and only numbers return to JS.
 */
class PavoOmrModule : Module() {
  private val loaded by lazy { OpenCVLoader.initLocal() }

  override fun definition() = ModuleDefinition {
    Name("PavoOmr")

    Function("isAvailable") { loaded }

    AsyncFunction("analyzeSheet") { imageUri: String, templateJson: String, quick: Boolean, saveWarped: Boolean ->
      if (!loaded) throw CodedException("E_OPENCV", "The on-device scanner could not start.", null)
      val path = Uri.parse(imageUri).path ?: throw CodedException("E_IMAGE", "The photo could not be opened.", null)
      val image = Imgcodecs.imread(path, Imgcodecs.IMREAD_GRAYSCALE)
      if (image.empty()) throw CodedException("E_IMAGE", "The photo could not be read.", null)
      try {
        val analysis = OmrEngine(SheetTemplate.fromJson(templateJson)).analyze(image, quick)
        val json = analysis.toJson()
        val warped = analysis.warped
        if (saveWarped && warped != null) {
          val directory = File(appContext.reactContext!!.cacheDir, "pavo-omr").apply { mkdirs() }
          val target = File(directory, "${UUID.randomUUID()}.jpg")
          Imgcodecs.imwrite(target.path, warped, MatOfInt(Imgcodecs.IMWRITE_JPEG_QUALITY, 82))
          json.put("warpedImageUri", Uri.fromFile(target).toString())
        }
        warped?.release()
        json.toString()
      } finally {
        image.release()
      }
    }
  }
}
