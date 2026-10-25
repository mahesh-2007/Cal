package com.mycalai.app

import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateGroupByPeriodRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.time.Instant
import java.time.LocalDateTime
import java.time.Period
import java.time.ZoneId
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

@CapacitorPlugin(name = "StepAggregation")
class StepAggregationPlugin : Plugin() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    override fun handleOnDestroy() {
        scope.cancel()
        super.handleOnDestroy()
    }

    @PluginMethod
    fun readDailyTotals(call: PluginCall) {
        val startInstant = call.getString("startDate")?.let(Instant::parse)
        val endInstant = call.getString("endDate")?.let(Instant::parse)
        if (startInstant == null || endInstant == null || endInstant <= startInstant) {
            call.reject("A valid startDate and endDate are required")
            return
        }
        val zone = ZoneId.systemDefault()
        val start = LocalDateTime.ofInstant(startInstant, zone)
        val end = LocalDateTime.ofInstant(endInstant, zone)

        scope.launch {
            try {
                val client = HealthConnectClient.getOrCreate(context)
                val buckets = client.aggregateGroupByPeriod(
                    AggregateGroupByPeriodRequest(
                        metrics = setOf(StepsRecord.COUNT_TOTAL),
                        timeRangeFilter = TimeRangeFilter.between(start, end),
                        timeRangeSlicer = Period.ofDays(1)
                    )
                )
                val days = JSArray()
                buckets.forEach { bucket ->
                    days.put(
                        JSObject()
                            .put("startDate", bucket.startTime.toString())
                            .put("steps", bucket.result[StepsRecord.COUNT_TOTAL] ?: 0L)
                    )
                }
                call.resolve(JSObject().put("days", days))
            } catch (error: Exception) {
                call.reject(error.message ?: "Could not read aggregated step totals", error)
            }
        }
    }
}
