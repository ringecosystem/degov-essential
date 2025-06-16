# Degov Agent

## OpenZeppelin Status Lifecycle

https://github.com/OpenZeppelin/openzeppelin-contracts/blob/f27019d48eee32551e5c9d31849afcaa99944545/contracts/governance/IGovernor.sol#L16

```typescript
enum ProposalState {
  Pending,
  Active,
  Canceled,
  Defeated,
  Succeeded,
  Queued,
  Expired,
  Executed,
}
```


```mathematia
                      ┌────────────┐
                      │  Pending   │
                      └────┬───────┘
                           │ votingDelay reached
                           ▼
                      ┌────────────┐
                      │   Active   │
                      └────┬───────┘
     ┌────────────┬────────┼─────────────┬─────────────┐
     │            │        │             │             │
     ▼            ▼        ▼             ▼             ▼
Canceled     Defeated   Succeeded    (manual)       (manual)
                        ┌──────┐      Cancel         Cancel
                        ▼
                    ┌──────────┐
                    │  Queued  │  <- Timelock
                    └────┬─────┘
                         │
                         ▼
                    ┌──────────┐
                    │ Executed │
                    └──────────┘

Or if the queue phase times out:
                    ▼
                ┌─────────┐
                │ Expired │
                └─────────┘

```
