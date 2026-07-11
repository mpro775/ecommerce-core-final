import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  MetricLabels,
  HistogramOptions,
  CounterOptions,
  GaugeOptions,
  MetricsCollector,
} from './metrics.types';

interface MetricValue {
  value: number;
  labels: MetricLabels;
}

interface HistogramValue {
  sum: number;
  count: number;
  buckets: { le: string; count: number }[];
  labels: MetricLabels;
}

interface StoredMetric {
  type: 'counter' | 'gauge' | 'histogram';
  name: string;
  help: string;
  labelNames: string[];
  values: MetricValue[] | HistogramValue[];
  buckets?: number[];
}

const DEFAULT_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

@Injectable()
export class MetricsService implements MetricsCollector, OnModuleInit {
  private metrics: Map<string, StoredMetric> = new Map();
  private prefix: string;
  private defaultLabels: MetricLabels;

  constructor(private readonly configService: ConfigService) {
    this.prefix = configService.get<string>('METRICS_PREFIX', 'ecommerce_core_');
    this.defaultLabels = {
      app: 'api',
      env: configService.get<string>('NODE_ENV', 'development'),
    };
  }

  onModuleInit(): void {
    this.registerDefaultMetrics();
  }

  private registerDefaultMetrics(): void {
    this.registerCounter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'path', 'status', 'store_id'],
    });

    this.registerHistogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'path', 'status', 'store_id'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
    });

    this.registerCounter({
      name: 'errors_total',
      help: 'Total number of errors',
      labelNames: ['type', 'store_id'],
    });

    this.registerGauge({
      name: 'db_connections_active',
      help: 'Number of active database connections',
      labelNames: ['pool'],
    });

    this.registerGauge({
      name: 'queue_messages_pending',
      help: 'Number of pending messages in queue',
      labelNames: ['queue'],
    });

    this.registerCounter({
      name: 'orders_created_total',
      help: 'Total number of orders created',
      labelNames: ['store_id', 'payment_method'],
    });

    this.registerCounter({
      name: 'checkout_started_total',
      help: 'Total number of checkouts started',
      labelNames: ['store_id'],
    });

    this.registerCounter({
      name: 'checkout_completed_total',
      help: 'Total number of checkouts completed',
      labelNames: ['store_id'],
    });

    this.registerHistogram({
      name: 'checkout_duration_seconds',
      help: 'Duration of checkout process in seconds',
      labelNames: ['store_id'],
      buckets: [1, 5, 10, 30, 60, 120],
    });
  }

  registerCounter(options: CounterOptions): void {
    const name = this.prefix + options.name;
    this.metrics.set(name, {
      type: 'counter',
      name,
      help: options.help,
      labelNames: options.labelNames || [],
      values: [],
    });
  }

  registerGauge(options: GaugeOptions): void {
    const name = this.prefix + options.name;
    this.metrics.set(name, {
      type: 'gauge',
      name,
      help: options.help,
      labelNames: options.labelNames || [],
      values: [],
    });
  }

  registerHistogram(options: HistogramOptions): void {
    const name = this.prefix + options.name;
    this.metrics.set(name, {
      type: 'histogram',
      name,
      help: options.help,
      labelNames: options.labelNames || [],
      values: [],
      buckets: options.buckets || DEFAULT_BUCKETS,
    });
  }

  private getLabelKey(labels: MetricLabels | undefined): string {
    if (!labels) return '{}';
    const sorted = Object.entries(labels)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return JSON.stringify(Object.fromEntries(sorted));
  }

  private findMetricValueIndex(metric: StoredMetric, labels: MetricLabels | undefined): number {
    const labelKey = this.getLabelKey(labels);
    return (metric.values as MetricValue[]).findIndex(
      (v) => this.getLabelKey(v.labels) === labelKey,
    );
  }

  incrementCounter(name: string, labels?: MetricLabels, value = 1): void {
    const metricName = this.prefix + name;
    const metric = this.metrics.get(metricName);
    if (!metric || metric.type !== 'counter') return;

    const mergedLabels = { ...this.defaultLabels, ...labels };
    const index = this.findMetricValueIndex(metric, mergedLabels);

    if (index >= 0) {
      (metric.values[index] as MetricValue).value += value;
    } else {
      (metric.values as MetricValue[]).push({ value, labels: mergedLabels });
    }
  }

  decrementCounter(name: string, labels?: MetricLabels, value = 1): void {
    this.incrementCounter(name, labels, -value);
  }

  observeHistogram(name: string, value: number, labels?: MetricLabels): void {
    const metricName = this.prefix + name;
    const metric = this.metrics.get(metricName);
    if (!metric || metric.type !== 'histogram') return;

    const mergedLabels = { ...this.defaultLabels, ...labels };
    const labelKey = this.getLabelKey(mergedLabels);
    const existing = (metric.values as HistogramValue[]).find(
      (v) => this.getLabelKey(v.labels) === labelKey,
    );

    if (existing) {
      existing.sum += value;
      existing.count += 1;
      for (const bucket of existing.buckets) {
        if (value <= parseFloat(bucket.le)) {
          bucket.count += 1;
        }
      }
    } else {
      const buckets = (metric.buckets || DEFAULT_BUCKETS).map((le) => ({
        le: le.toString(),
        count: value <= le ? 1 : 0,
      }));
      buckets.push({ le: '+Inf', count: 1 });

      (metric.values as HistogramValue[]).push({
        sum: value,
        count: 1,
        buckets,
        labels: mergedLabels,
      });
    }
  }

  setGauge(name: string, value: number, labels?: MetricLabels): void {
    const metricName = this.prefix + name;
    const metric = this.metrics.get(metricName);
    if (!metric || metric.type !== 'gauge') return;

    const mergedLabels = { ...this.defaultLabels, ...labels };
    const index = this.findMetricValueIndex(metric, mergedLabels);

    if (index >= 0) {
      (metric.values[index] as MetricValue).value = value;
    } else {
      (metric.values as MetricValue[]).push({ value, labels: mergedLabels });
    }
  }

  incrementGauge(name: string, labels?: MetricLabels, value = 1): void {
    const metricName = this.prefix + name;
    const metric = this.metrics.get(metricName);
    if (!metric || metric.type !== 'gauge') return;

    const mergedLabels = { ...this.defaultLabels, ...labels };
    const index = this.findMetricValueIndex(metric, mergedLabels);

    if (index >= 0) {
      (metric.values[index] as MetricValue).value += value;
    } else {
      (metric.values as MetricValue[]).push({ value, labels: mergedLabels });
    }
  }

  decrementGauge(name: string, labels?: MetricLabels, value = 1): void {
    this.incrementGauge(name, labels, -value);
  }

  timing(name: string, startTime: number, labels?: MetricLabels): void {
    const duration = (Date.now() - startTime) / 1000;
    this.observeHistogram(name, duration, labels);
  }

  async getMetrics(): Promise<string> {
    const lines: string[] = [];
    lines.push('# HELP ecommerce_core_info Application info');
    lines.push('# TYPE ecommerce_core_info gauge');
    lines.push(`ecommerce_core_info{version="1.0.0"} 1`);
    lines.push('');

    for (const [, metric] of this.metrics) {
      lines.push(`# HELP ${metric.name} ${metric.help}`);
      lines.push(`# TYPE ${metric.name} ${metric.type}`);

      if (metric.type === 'histogram') {
        for (const value of metric.values as HistogramValue[]) {
          const labelStr = this.formatLabels(value.labels);
          for (const bucket of value.buckets) {
            const bucketLabels = { ...value.labels, le: bucket.le };
            lines.push(`${metric.name}_bucket${this.formatLabels(bucketLabels)} ${bucket.count}`);
          }
          lines.push(`${metric.name}_sum${labelStr} ${value.sum}`);
          lines.push(`${metric.name}_count${labelStr} ${value.count}`);
        }
      } else {
        for (const value of metric.values as MetricValue[]) {
          const labelStr = this.formatLabels(value.labels);
          lines.push(`${metric.name}${labelStr} ${value.value}`);
        }
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  private formatLabels(labels: MetricLabels): string {
    const entries = Object.entries(labels).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return '';

    const formatted = entries.map(([k, v]) => `${k}="${v}"`);
    return `{${formatted.join(',')}}`;
  }
}
