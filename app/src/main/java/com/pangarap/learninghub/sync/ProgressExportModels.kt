package com.pangarap.learninghub.sync

import kotlinx.serialization.Serializable

@Serializable
data class ProgressExport(
    val payloadType: String = "progress_export",
    val studentId: String,
    val displayName: String,
    val gradeLevel: Int,
    val section: String,
    val schoolYear: String,
    val quizAttempts: List<QuizAttemptExport>,
    val completedModules: List<String>,
    val weakTopics: List<String>,
    val gradeCompletionPercent: Int
)

@Serializable
data class QuizAttemptExport(
    val attemptId: String,
    val moduleId: String,
    val score: Int,
    val totalItems: Int,
    val weakTopic: String,
    val strongTopic: String = "",
    val masteryLevel: String = "DEVELOPING",
    val durationSeconds: Long = 0,
    val attemptNumber: Int = 1,
    val submittedAt: Long
)

@Serializable
data class StudentProfileQr(
    val payloadType: String = "student_profile",
    val studentId: String = "",
    val studentNumber: String,
    val firstName: String,
    val lastName: String,
    val middleInitial: String = "",
    val gradeLevel: Int,
    val section: String,
    val birthday: String = ""
)

@Serializable
data class QuizResultQr(
    val payloadType: String = "quiz_result",
    val attemptId: String,
    val studentId: String,
    val studentNumber: String,
    val firstName: String,
    val lastName: String,
    val middleInitial: String = "",
    val displayName: String,
    val gradeLevel: Int,
    val section: String,
    val moduleId: String,
    val moduleTitle: String,
    val subject: String,
    val competencyCode: String,
    val score: Int,
    val totalItems: Int,
    val weakTopic: String,
    val strongTopic: String,
    val masteryLevel: String,
    val durationSeconds: Long,
    val attemptNumber: Int,
    val submittedAt: Long
)

@Serializable
data class TeacherModuleQr(
    val payloadType: String = "teacher_module",
    val moduleId: String,
    val title: String,
    val subject: String,
    val gradeLevel: Int,
    val quarter: Int,
    val moduleNumber: Int,
    val competencyCode: String,
    val content: String,
    val questions: List<TeacherModuleQuestionQr> = emptyList()
)

@Serializable
data class TeacherModuleQuestionQr(
    val id: String,
    val type: String,
    val questionText: String,
    val choices: List<String> = emptyList(),
    val correctAnswer: String,
    val topicTag: String
)
