package org.pavo.omr

import org.json.JSONArray
import org.json.JSONObject
import org.opencv.core.Point

/** Answer-sheet geometry in PDF points, origin top-left (matches the TypeScript template). */
data class SheetTemplate(
  val templateId: String,
  val layoutVersion: Int,
  val pageWidth: Double,
  val pageHeight: Double,
  val markerSize: Double,
  /** Top-left, top-right, bottom-right, bottom-left marker centers. */
  val markerCenters: List<Point>,
  val orientationCenter: Point,
  val orientationSize: Double,
  val sheetCodeX: Double,
  val sheetCodeY: Double,
  val sheetCodeSize: Double,
  val bubbleRadius: Double,
  val questions: List<List<Point>>,
  val classIdRadius: Double,
  val classIdBubbles: List<List<Point>>
) {
  companion object {
    fun fromJson(json: String): SheetTemplate {
      val root = JSONObject(json)
      require(root.getString("kind") == "pavo-answer-sheet-template") { "Not a PAVO answer-sheet template." }
      require(root.getInt("schemaVersion") == 1) { "Unsupported answer-sheet template version." }
      val page = root.getJSONObject("page")
      val markers = root.getJSONObject("markers")
      val orientation = root.getJSONObject("orientationMarker")
      val sheetCode = root.getJSONObject("sheetCode")
      val markerCenters = points(markers.getJSONArray("centers"))
      require(markerCenters.size == 4) { "A template needs four registration markers." }
      val questionsJson = root.getJSONArray("questions")
      return SheetTemplate(
        templateId = root.getString("templateId"),
        layoutVersion = root.getInt("layoutVersion"),
        pageWidth = page.getDouble("width"),
        pageHeight = page.getDouble("height"),
        markerSize = markers.getDouble("size"),
        markerCenters = markerCenters,
        orientationCenter = point(orientation.getJSONObject("center")),
        orientationSize = orientation.getDouble("size"),
        sheetCodeX = sheetCode.getDouble("x"),
        sheetCodeY = sheetCode.getDouble("y"),
        sheetCodeSize = sheetCode.getDouble("size"),
        bubbleRadius = root.getDouble("bubbleRadius"),
        questions = (0 until questionsJson.length()).map { index ->
          points(questionsJson.getJSONObject(index).getJSONArray("bubbles"))
        },
        classIdRadius = root.getDouble("classIdBubbleRadius"),
        classIdBubbles = root.getJSONArray("classIdBubbles").let { columns ->
          (0 until columns.length()).map { index -> points(columns.getJSONArray(index)) }
        }
      )
    }

    private fun point(json: JSONObject) = Point(json.getDouble("x"), json.getDouble("y"))

    private fun points(json: JSONArray) = (0 until json.length()).map { point(json.getJSONObject(it)) }
  }
}
