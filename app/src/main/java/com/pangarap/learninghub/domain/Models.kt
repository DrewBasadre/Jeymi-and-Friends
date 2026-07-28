package com.pangarap.learninghub.domain

enum class SubjectType(val label: String) {
    SCIENCE("Science"),
    MATH("Math"),
    ENGLISH("English"),
    ADDED_MATERIALS("Added Materials");

    companion object {
        fun fromName(value: String): SubjectType = entries.firstOrNull { it.name == value } ?: SCIENCE
    }
}

enum class QuestionType {
    MULTIPLE_CHOICE,
    TRUE_FALSE,
    IDENTIFICATION,
    FILL_BLANK,
    ENUMERATION,
    PROBLEM_SOLVING
}

enum class ProgressStatus { NOT_STARTED, IN_PROGRESS, COMPLETED, ARCHIVED }

enum class MasteryLevel(val label: String) {
    BEGINNER("Beginning"),
    DEVELOPING("Developing"),
    PROFICIENT("Proficient"),
    ADVANCED("Advanced")
}

data class StudentDashboardSummary(
    val studentId: String,
    val studentNumber: String,
    val firstName: String,
    val lastName: String,
    val name: String,
    val gradeLevel: Int,
    val section: String,
    val completedModules: Int,
    val totalModules: Int,
    val averageScore: Double,
    val weakTopic: String,
    val strongTopic: String,
    val gradeCompletionPercent: Int,
    val totalAttempts: Int,
    val lastQuizDurationSeconds: Long
)

data class TeacherDashboardSummary(
    val classAverage: Double,
    val topStudents: List<RecordBookRow>,
    val lowestStudents: List<RecordBookRow>,
    val interventionStudents: List<RecordBookRow>
)

data class RecordBookRow(
    val studentId: String,
    val studentNumber: String,
    val firstName: String,
    val lastName: String,
    val middleInitial: String,
    val name: String,
    val gradeLevel: Int,
    val section: String,
    val averageScore: Double,
    val completedModules: Int,
    val totalModules: Int,
    val weakTopic: String,
    val gradeCompletionPercent: Int,
    val isArchived: Boolean,
    val totalAttempts: Int,
    val lastQuizDurationSeconds: Long
)

data class QuizResult(
    val attemptId: String,
    val moduleId: String,
    val moduleTitle: String,
    val score: Int,
    val totalItems: Int,
    val weakTopic: String,
    val strongTopic: String,
    val masteryLevel: MasteryLevel,
    val attemptNumber: Int,
    val durationSeconds: Long,
    val resultJson: String
)

data class GurobotInput(
    val gradeLevel: Int,
    val subject: String,
    val competencyCode: String,
    val topic: String,
    val action: String,
    val quarter: Int,
    val moduleNumber: Int
)

data class GurobotResponse(
    val content: String,
    val sourceLabel: String
)
