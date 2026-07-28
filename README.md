# Vorster Unlimited Trading v1 — Alpha 7.2.2

Automatic Order History and Predictions.

## New in this sprint

- Sales Visits is replaced by Customer Order Intelligence
- Predictions are calculated automatically from completed order history
- No detailed visit form is required
- Customer status: Overdue, Due soon, Recent or Learning
- Predicted next-order date
- Typical ordering interval
- Prediction confidence
- Average order value
- Expected order-value range
- Likely products with predicted average quantities
- Preferred colours
- Complete customer order history
- Latest quote link
- Dashboard predicted-orders section
- Optional one-tap no-order result:
  - No order today
  - Customer unavailable
  - Follow up later
- Existing orders, quotes, customers and Alpha 7.2.1 visit data remain compatible

## Prediction rules

- One order: not enough history
- Two orders: early estimate
- Three or more orders: active prediction
- Six or more orders: higher confidence
- Predictions use the customer's typical interval between completed orders
- Expected value uses recent order values with a practical range

## Test flow

1. Open Predict / Order Intelligence.
2. Open a customer with several completed orders.
3. Check predicted date, interval, products, quantities and colours.
4. Create another completed order for that customer.
5. Return to Order Intelligence and confirm the figures update automatically.
6. Test the optional No-order result.
7. Confirm no detailed visit form is required.
