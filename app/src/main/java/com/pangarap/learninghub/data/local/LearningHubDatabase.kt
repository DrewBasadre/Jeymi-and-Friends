package com.pangarap.learninghub.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(
    entities = [
        StudentEntity::class,
        ModuleEntity::class,
        QuizQuestionEntity::class,
        QuizAttemptEntity::class,
        ProgressEntity::class,
        LessonPlanEntity::class,
        TeacherMaterialEntity::class
    ],
    version = 3,
    exportSchema = true
)
abstract class LearningHubDatabase : RoomDatabase() {
    abstract fun studentDao(): StudentDao
    abstract fun moduleDao(): ModuleDao
    abstract fun quizQuestionDao(): QuizQuestionDao
    abstract fun quizAttemptDao(): QuizAttemptDao
    abstract fun progressDao(): ProgressDao
    abstract fun lessonPlanDao(): LessonPlanDao
    abstract fun teacherMaterialDao(): TeacherMaterialDao

    companion object {
        private val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE students ADD COLUMN studentNumber TEXT NOT NULL DEFAULT ''")
                db.execSQL("ALTER TABLE students ADD COLUMN firstName TEXT NOT NULL DEFAULT ''")
                db.execSQL("ALTER TABLE students ADD COLUMN lastName TEXT NOT NULL DEFAULT ''")
                db.execSQL("ALTER TABLE students ADD COLUMN pin TEXT NOT NULL DEFAULT '1234'")
                db.execSQL("UPDATE students SET studentNumber = id WHERE studentNumber = ''")
                db.execSQL(
                    """
                    UPDATE students
                    SET firstName = CASE
                        WHEN instr(name, ' ') > 0 THEN substr(name, 1, instr(name, ' ') - 1)
                        ELSE name
                    END
                    WHERE firstName = ''
                    """.trimIndent()
                )
                db.execSQL(
                    """
                    UPDATE students
                    SET lastName = CASE
                        WHEN instr(name, ' ') > 0 THEN substr(name, instr(name, ' ') + 1)
                        ELSE name
                    END
                    WHERE lastName = ''
                    """.trimIndent()
                )
                db.execSQL("UPDATE modules SET subject = 'MATH', title = replace(title, 'Technology', 'Math'), competencyCode = replace(competencyCode, 'TECH', 'MATH') WHERE subject = 'TECHNOLOGY'")
                db.execSQL("UPDATE lesson_plans SET subject = 'MATH', title = replace(title, 'Technology', 'Math'), competencyCode = replace(competencyCode, 'TECH', 'MATH') WHERE subject = 'TECHNOLOGY'")
                db.execSQL("UPDATE teacher_materials SET subject = 'MATH', title = replace(title, 'Technology', 'Math') WHERE subject = 'TECHNOLOGY'")
                db.execSQL("ALTER TABLE quiz_attempts ADD COLUMN strongTopic TEXT NOT NULL DEFAULT ''")
                db.execSQL("ALTER TABLE quiz_attempts ADD COLUMN masteryLevel TEXT NOT NULL DEFAULT 'DEVELOPING'")
                db.execSQL("ALTER TABLE quiz_attempts ADD COLUMN durationSeconds INTEGER NOT NULL DEFAULT 0")
                db.execSQL("ALTER TABLE quiz_attempts ADD COLUMN attemptNumber INTEGER NOT NULL DEFAULT 1")
            }
        }

        private val MIGRATION_2_3 = object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE students ADD COLUMN middleInitial TEXT NOT NULL DEFAULT ''")
                db.execSQL("ALTER TABLE students ADD COLUMN birthday TEXT NOT NULL DEFAULT ''")
                db.execSQL("ALTER TABLE students ADD COLUMN profileImageUri TEXT NOT NULL DEFAULT ''")
            }
        }

        fun create(context: Context): LearningHubDatabase =
            Room.databaseBuilder(
                context.applicationContext,
                LearningHubDatabase::class.java,
                "learninghub-ph.db"
            )
                .addMigrations(MIGRATION_1_2, MIGRATION_2_3)
                .build()
    }
}
