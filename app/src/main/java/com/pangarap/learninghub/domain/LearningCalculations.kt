package com.pangarap.learninghub.domain

import kotlin.math.roundToInt

object LearningCalculations {
    fun masteryFor(score: Int, totalItems: Int): MasteryLevel {
        if (totalItems <= 0) return MasteryLevel.BEGINNER
        val percent = score.toDouble() / totalItems
        return when {
            percent >= 0.9 -> MasteryLevel.ADVANCED
            percent >= 0.75 -> MasteryLevel.PROFICIENT
            percent >= 0.5 -> MasteryLevel.DEVELOPING
            else -> MasteryLevel.BEGINNER
        }
    }

    fun averagePercent(scores: List<Pair<Int, Int>>): Double {
        if (scores.isEmpty()) return 0.0
        val values = scores.mapNotNull { (score, total) ->
            if (total <= 0) null else score.toDouble() / total * 100.0
        }
        if (values.isEmpty()) return 0.0
        return (values.average() * 10.0).roundToInt() / 10.0
    }

    fun completionPercent(completed: Int, total: Int): Int {
        if (total <= 0) return 0
        return ((completed.coerceAtLeast(0).toDouble() / total) * 100).roundToInt().coerceIn(0, 100)
    }
}
