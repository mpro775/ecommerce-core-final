export interface MetricLabels {
  [key: string]: string | number;
}

export interface HistogramOptions {
  name: string;
  help: string;
  labelNames?: string[];
  buckets?: number[];
}

export interface CounterOptions {
  name: string;
  help: string;
  labelNames?: string[];
}

export interface GaugeOptions {
  name: string;
  help: string;
  labelNames?: string[];
}

export interface MetricsCollector {
  incrementCounter(name: string, labels?: MetricLabels, value?: number): void;
  decrementCounter(name: string, labels?: MetricLabels, value?: number): void;
  observeHistogram(name: string, value: number, labels?: MetricLabels): void;
  setGauge(name: string, value: number, labels?: MetricLabels): void;
  incrementGauge(name: string, labels?: MetricLabels, value?: number): void;
  decrementGauge(name: string, labels?: MetricLabels, value?: number): void;
  timing(name: string, startTime: number, labels?: MetricLabels): void;
  getMetrics(): Promise<string>;
}
