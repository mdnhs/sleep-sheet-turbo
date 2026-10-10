---
name: Guest Checkout Implementation
description: Guest checkout flow added — guests can order without account, 4-field form, track by phone
type: project
---

Guest checkout implemented. Key decisions:

**Why:** Bangladesh customers unfamiliar with online accounts; needed frictionless ordering.

**How to apply:** Any future checkout changes must handle both user and guest paths (userId nullable in Order).

- Order.userId is now nullable (guest orders have userId=null)
- Order has guestName, guestPhone, guestEmail fields
- Cart has guestItems in Redux state (localStorage-persisted client-side)
- Checkout flow: initial → payment → confirmation → placedSuccessfully (shipping step removed)
- /track-order page: guests enter phone number to see their orders
- COD is default payment method
- Tax = 8% of subtotal, no shipping cost (admin handles delivery manually)
- shippingCity/State/PostalCode/Country are now nullable in DB
