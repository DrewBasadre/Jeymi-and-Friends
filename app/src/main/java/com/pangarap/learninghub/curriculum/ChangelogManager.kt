package com.pangarap.learninghub.curriculum

import java.io.File
import java.io.FileOutputStream
import java.io.OutputStreamWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/*
 * Integration Notes
 * -----------------
 * This utility is intentionally independent from CurriculumStore, LessonPlanService,
 * and QuizGenerationService. Each module can call it without creating circular
 * dependencies. The canonical path comes from the Phase 0 audit: the existing
 * CHANGELOG.md file at the project root.
 *
 * Runtime configuration:
 * - changelogRelativePath: defaults to the audited canonical CHANGELOG.md target.
 */
class ChangelogManager(
    private val rootDirectory: File = File("."),
    private val changelogRelativePath: String = DEFAULT_CHANGELOG_RELATIVE_PATH
) {
    fun append(
        eventType: ChangelogEventType,
        componentName: String,
        description: String,
        details: List<String>
    ) {
        val file = File(rootDirectory, changelogRelativePath)
        val entry = buildEntry(eventType, componentName, description, details)
        runCatching {
            file.parentFile?.mkdirs()
            OutputStreamWriter(FileOutputStream(file, true), Charsets.UTF_8).use { writer ->
                writer.append(entry)
            }
        }.onFailure { failure ->
            val safeMessage = failure.message.orEmpty().take(180)
            System.err.println("Changelog write failed: ${failure::class.simpleName}: $safeMessage")
        }
    }

    fun logAuditComplete(auditReport: String) {
        append(
            eventType = ChangelogEventType.AUDIT_COMPLETE,
            componentName = "Phase 0 Stack Audit",
            description = "Completed autonomous stack audit before curriculum generation module implementation.",
            details = auditReport.lines().filter { it.isNotBlank() }
        )
    }

    fun logModuleGenerated(
        componentName: String,
        description: String,
        details: List<String>
    ) {
        append(
            eventType = ChangelogEventType.MODULE_GENERATED,
            componentName = componentName,
            description = description,
            details = details
        )
    }

    fun logLessonGenerated(
        lessonTitle: String,
        subject: String,
        gradeLevel: String,
        retrievedChunkCount: Int
    ) {
        append(
            eventType = ChangelogEventType.CURRICULUM_INDEXED,
            componentName = "LessonPlanService",
            description = "Generated a curriculum-grounded lesson plan.",
            details = listOf(
                "Lesson title: $lessonTitle",
                "Subject: $subject",
                "Grade level: $gradeLevel",
                "Curriculum chunks retrieved: $retrievedChunkCount"
            )
        )
    }

    fun logQuizGenerated(
        lessonTitle: String,
        subject: String,
        gradeLevel: String,
        questionCount: Int,
        typeDistribution: Map<String, Int>,
        competencyCodes: List<String>
    ) {
        append(
            eventType = ChangelogEventType.QUIZ_GENERATED,
            componentName = "QuizGenerationService",
            description = "Generated a curriculum-grounded quiz after the lesson unlock gate passed.",
            details = listOf(
                "Lesson title: $lessonTitle",
                "Subject: $subject",
                "Grade level: $gradeLevel",
                "Questions generated: $questionCount",
                "Question type distribution: ${typeDistribution.entries.joinToString { "${it.key}=${it.value}" }}",
                "Curriculum competency codes: ${competencyCodes.distinct().joinToString().ifBlank { "None supplied" }}"
            )
        )
    }

    fun logError(
        componentName: String,
        errorCodeOrType: String,
        description: String
    ) {
        append(
            eventType = ChangelogEventType.ERROR,
            componentName = componentName,
            description = description.take(500),
            details = listOf("Error code or type: $errorCodeOrType")
        )
    }

    private fun buildEntry(
        eventType: ChangelogEventType,
        componentName: String,
        description: String,
        details: List<String>
    ): String {
        val timestamp = utcFormatter().format(Date())
        val normalizedDetails = details
            .flatMap { detail -> detail.lines().ifEmpty { listOf("") } }
            .map { it.trim().ifBlank { "(blank)" } }
        val detailBlock = normalizedDetails.joinToString(separator = "\n") { "- $it" }
        val separator = "\u2014"
        return """
            ## [$timestamp UTC] $separator ${eventType.name}
            **Component:** ${componentName.sanitizeForLog()}
            **Description:** ${description.sanitizeForLog()}
            **Details:**
            $detailBlock
            ---

        """.trimIndent()
    }

    private fun String.sanitizeForLog(): String =
        lines().joinToString(" ") { it.trim() }.take(1_000)

    private fun utcFormatter(): SimpleDateFormat =
        SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }

    companion object {
        const val DEFAULT_CHANGELOG_RELATIVE_PATH = "CHANGELOG.md"
    }
}

enum class ChangelogEventType {
    INIT,
    MODULE_GENERATED,
    VISUAL_GENERATED,
    QUIZ_GENERATED,
    CURRICULUM_INDEXED,
    CONFIG_CHANGE,
    ERROR,
    AUDIT_COMPLETE
}
