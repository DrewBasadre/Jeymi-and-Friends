package com.pangarap.learninghub.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "students")
data class StudentEntity(
    @PrimaryKey val id: String,
    val studentNumber: String,
    val firstName: String,
    val lastName: String,
    val middleInitial: String = "",
    val name: String,
    val gradeLevel: Int,
    val section: String,
    val birthday: String = "",
    val profileImageUri: String = "",
    val pin: String,
    val avatarColor: Long,
    val isArchived: Boolean = false
)

@Entity(tableName = "modules")
data class ModuleEntity(
    @PrimaryKey val id: String,
    val title: String,
    val subject: String,
    val gradeLevel: Int,
    val quarter: Int,
    val competencyCode: String,
    val content: String,
    val isTeacherCreated: Boolean = false
)

@Entity(tableName = "quiz_questions")
data class QuizQuestionEntity(
    @PrimaryKey val id: String,
    val moduleId: String,
    val type: String,
    val questionText: String,
    val choicesJson: String,
    val correctAnswer: String,
    val topicTag: String
)

@Entity(tableName = "quiz_attempts")
data class QuizAttemptEntity(
    @PrimaryKey val id: String,
    val studentId: String,
    val moduleId: String,
    val score: Int,
    val totalItems: Int,
    val weakTopic: String,
    val strongTopic: String,
    val masteryLevel: String,
    val durationSeconds: Long,
    val attemptNumber: Int,
    val submittedAt: Long
)

@Entity(tableName = "progress")
data class ProgressEntity(
    @PrimaryKey val id: String,
    val studentId: String,
    val moduleId: String,
    val status: String,
    val masteryLevel: String,
    val updatedAt: Long
)

@Entity(tableName = "lesson_plans")
data class LessonPlanEntity(
    @PrimaryKey val id: String,
    val title: String,
    val subject: String,
    val gradeLevel: Int,
    val competencyCode: String,
    val topic: String,
    val generatedContent: String,
    val createdAt: Long
)

@Entity(tableName = "teacher_materials")
data class TeacherMaterialEntity(
    @PrimaryKey val id: String,
    val title: String,
    val subject: String,
    val gradeLevel: Int,
    val content: String
)
