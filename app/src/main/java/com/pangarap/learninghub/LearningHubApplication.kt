package com.pangarap.learninghub

import android.app.Application
import com.pangarap.learninghub.di.AppContainer

class LearningHubApplication : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }
}
