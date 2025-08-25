# Retry handler example

```ts
const onRetryHandler = (attempt: number, error: unknown, delay: number) => {
  // logging hoặc metrics
};

retryWithStrategy(async () => { /* ... */ }, {
  ...retryStrategies.network,
  onRetry: onRetryHandler
});
```
