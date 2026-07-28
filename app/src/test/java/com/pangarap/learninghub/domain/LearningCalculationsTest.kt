package com.pangarap.learninghub.domain

import org.junit.Assert.assertEquals
import org.junit.Test

class LearningCalculationsTest {
    @Test
    fun masteryForUsesExpectedScoreBands() {
        assertEquals(MasteryLevel.ADVANCED, LearningCalculations.masteryFor(9, 10))
        assertEquals(MasteryLevel.PROFICIENT, LearningCalculations.masteryFor(8, 10))
        assertEquals(MasteryLevel.DEVELOPING, LearningCalculations.masteryFor(5, 10))
        assertEquals(MasteryLevel.BEGINNER, LearningCalculations.masteryFor(4, 10))
    }

    @Test
    fun averagePercentIgnoresInvalidTotals() {
        assertEquals(75.0, LearningCalculations.averagePercent(listOf(3 to 4, 0 to 0)), 0.0)
    }

    @Test
    fun completionPercentIsClamped() {
        assertEquals(67, LearningCalculations.completionPercent(2, 3))
        assertEquals(0, LearningCalculations.completionPercent(1, 0))
        assertEquals(100, LearningCalculations.completionPercent(5, 3))
    }
}
