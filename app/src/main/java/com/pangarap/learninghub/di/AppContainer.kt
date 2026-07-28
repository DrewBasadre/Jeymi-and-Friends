package com.pangarap.learninghub.di

import android.content.Context
import com.pangarap.learninghub.ai.GurobotRepository
import com.pangarap.learninghub.data.local.LearningHubDatabase
import com.pangarap.learninghub.data.local.SampleDataSeeder
import com.pangarap.learninghub.data.repository.ModuleRepository
import com.pangarap.learninghub.data.repository.QuizRepository
import com.pangarap.learninghub.data.repository.StudentRepository
import com.pangarap.learninghub.data.repository.SyncRepository
import com.pangarap.learninghub.data.repository.TeacherRepository

class AppContainer(context: Context) {
    val database: LearningHubDatabase = LearningHubDatabase.create(context)
    val seeder = SampleDataSeeder(database)
    val studentRepository = StudentRepository(database)
    val moduleRepository = ModuleRepository(database)
    val quizRepository = QuizRepository(database)
    val teacherRepository = TeacherRepository(database)
    val syncRepository = SyncRepository(database)
    val gurobotRepository = GurobotRepository()
}
