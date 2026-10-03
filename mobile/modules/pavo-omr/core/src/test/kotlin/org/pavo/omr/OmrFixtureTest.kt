package org.pavo.omr

import nu.pattern.OpenCV
import org.json.JSONObject
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.Test
import org.opencv.core.Mat
import org.opencv.core.MatOfInt
import org.opencv.core.Size
import org.opencv.imgcodecs.Imgcodecs
import org.opencv.imgproc.Imgproc
import java.io.File
import java.util.Random
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Renders the versioned fixture suite, runs the real engine on every photo,
 * and records measurements for the TypeScript classifier tests.
 */
class OmrFixtureTest {
  companion object {
    @JvmStatic
    @BeforeAll
    fun loadOpenCv() = OpenCV.loadLocally()
  }

  private val root = File(System.getProperty("omr.fixtures") ?: error("omr.fixtures is not set"))
  private val writeImages = System.getProperty("omr.writeImages") == "1"

  private fun cases(): List<JSONObject> {
    val spec = JSONObject(File(root, "fixtures.json").readText())
    val cases = spec.getJSONArray("cases")
    return (0 until cases.length()).map { cases.getJSONObject(it) }
  }

  private fun template(fixture: JSONObject) =
    SheetTemplate.fromJson(File(root, "templates/${fixture.getString("templateId")}.json").readText())

  private fun photo(fixture: JSONObject, index: Int): Mat {
    val page = FixtureRenderer.renderSheet(template(fixture), fixture, Random(index.toLong()))
    return FixtureRenderer.photograph(page, fixture.getJSONObject("transform"), 1000L + index)
  }

  @Test
  fun measuresEveryFixture() {
    val measurements = File(root, "measurements").apply { mkdirs() }
    val images = File(root, "images")
    if (writeImages) images.mkdirs()
    val failures = mutableListOf<String>()
    cases().forEachIndexed { index, fixture ->
      val name = fixture.getString("name")
      val image = photo(fixture, index)
      val started = System.nanoTime()
      val analysis = OmrEngine(template(fixture), if (System.getenv("OMR_DEBUG") == name) { line -> println(line) } else null).analyze(image)
      val elapsed = (System.nanoTime() - started) / 1_000_000
      File(measurements, "$name.json").writeText(analysis.toJson().toString(2) + "\n")
      if (writeImages) {
        val preview = Mat()
        Imgproc.resize(image, preview, Size(), 0.5, 0.5, Imgproc.INTER_AREA)
        Imgcodecs.imwrite(File(images, "$name.jpg").path, preview, MatOfInt(Imgcodecs.IMWRITE_JPEG_QUALITY, 70))
      }
      val expect = fixture.getJSONObject("expect")
      val located = analysis.markers.corners.size == 4
      if (located != expect.getBoolean("located")) failures += "$name: located=$located"
      if (expect.optString("sheetCode") == "match" && analysis.sheetCode != fixture.getString("sheetCodeText")) {
        failures += "$name: sheet code ${analysis.sheetCode}"
      }
      println(
        "%-22s located=%-5s markers=%d inferred=%-5s rot=%6.1f sharp=%7.1f glare=%.3f persp=%.2f drift=%.2f light=%.2f %dms"
          .format(
            name, located, analysis.markers.found, analysis.markers.inferred, analysis.rotationDegrees,
            analysis.metrics.sharpness, analysis.metrics.glare, analysis.metrics.perspective,
            analysis.metrics.gridDrift, analysis.metrics.lightingEvenness, elapsed
          )
      )
      analysis.warped?.release()
      image.release()
    }
    assertTrue(failures.isEmpty(), failures.joinToString("\n"))
  }

  @Test
  fun quickModeLocatesTheSheetForAutoCapture() {
    val fixtures = cases()
    val clean = fixtures.indexOfFirst { it.getString("name") == "clean-upright" }
    val quick = OmrEngine(template(fixtures[clean])).analyze(photo(fixtures[clean], clean), quick = true)
    assertEquals(4, quick.markers.found)
    assertTrue(quick.bubbleFill.isEmpty())
    assertTrue(quick.metrics.perspective > 0.9)
  }
}
