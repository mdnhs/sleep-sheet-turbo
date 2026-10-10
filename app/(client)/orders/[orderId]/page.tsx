import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOrderById } from "@/features/order/server/get-order";
import { formatDate } from "@/lib/utils";
import { ArrowLeft, CheckCircle, Package, Truck } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OrderActionButtons } from "./order-actions";
import { formatCurrency } from "@/lib/utils";
import FallbackImage from "@/components/ui/fallback-image";

// Private, per-order page — never indexable.
export const metadata: Metadata = {
  title: "Order Details",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ orderId: string }> };

export default async function OrderDetailPage({ params }: Props) {
  const { orderId } = await params;
  const order = await getOrderById(orderId);

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-16 text-center min-h-[70vh] flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">Order Not Found</h1>
        <p className="mb-8 text-muted-foreground">
          We couldn&apos;t find the order you&apos;re looking for.
        </p>
        <Button nativeButton={false} render={<Link href="/" />}>
          Return to Home
        </Button>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "DELIVERED":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "SHIPPING":
      case "Out for Delivery":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "PROCESSING":
      case "Payment Confirmed":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 min-h-screen">
      {/* Back button and order ID */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
        <Button
          variant="ghost"
          nativeButton={false}
          className="mb-4 sm:mb-0 -ml-4"
          render={<Link href="/" className="flex items-center" />}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Store
        </Button>
        <div className="text-right">
          <h1 className="text-xl font-bold">
            Order #{order.orderNumber}
          </h1>
          <p className="text-muted-foreground text-sm">
            Placed on {formatDate(String(order.createdAt))}
          </p>
        </div>
      </div>

      {/* Order Status Timeline */}
      <Card className="mb-8">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Order Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center mb-6">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                order.status
              )}`}
            >
              {order.status === "DELIVERED" ? (
                <CheckCircle className="mr-1 h-4 w-4" />
              ) : order.status === "SHIPPED" || order.status === "PROCESSING" ? (
                <Truck className="mr-1 h-4 w-4" />
              ) : (
                <Package className="mr-1 h-4 w-4" />
              )}
              {order.status}
            </span>
          </div>
          <div className="relative">
            <div className="absolute top-0 left-3 h-full w-0.5 bg-border"></div>
            <ul className="space-y-6">
              {order.OrderTimelineEvent.map((event, index) => {
                const createdAt = new Date(event.createdAt);
                const isLatest = index === order.OrderTimelineEvent.length - 1;

                return (
                  <li key={event.id} className="relative pl-10">
                    <div
                      className={`absolute left-0 top-1 h-6 w-6 rounded-full border ${
                        isLatest
                          ? "bg-primary border-primary text-primary-foreground"
                          : "bg-background border-muted-foreground"
                      } flex items-center justify-center`}
                    >
                      {isLatest ? (
                        <CheckCircle className="h-3 w-3" />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                      )}
                    </div>
                    <div className="font-medium text-sm">{event.status}</div>
                    <div className="text-xs text-muted-foreground">
                      {format(createdAt, "PPpp")}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card className="mb-8">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-center">Quantity</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex items-center">
                      <FallbackImage
                        src={item.product?.images?.[0]}
                        alt={item.product?.name ?? "Product"}
                        width={48}
                        height={48}
                        className="h-12 w-12 object-cover rounded-md mr-4 shrink-0"
                      />
                      <span className="font-medium text-sm">{item.product?.name ?? "Deleted product"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    ৳{item.price.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-center text-sm">{item.quantity}</TableCell>
                  <TableCell className="text-right font-medium text-sm">
                    ৳{(item.price * item.quantity).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Order Summary */}
          <div className="mt-6 border-t pt-6 text-sm">
            <div className="flex justify-between mb-2">
              <span className="text-muted-foreground">Subtotal</span>
              <span>৳{order.subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-muted-foreground">Shipping</span>
              <span>৳{order.deliveryCharge.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-bold text-lg pt-2 border-t">
              <span>Total</span>
              <span>৳{order.totalAmount.toLocaleString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Address and Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Shipping Address</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              <p className="font-medium">{order.user?.name ?? order.guestName ?? "Guest"}</p>
              {(order.user?.phone ?? order.guestPhone) && (
                <p className="text-muted-foreground">{order.user?.phone ?? order.guestPhone}</p>
              )}
              <p>{order.shippingAddress}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Payment Method</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">{order.paymentMethod}</p>
          </CardContent>
        </Card>
      </div>

      <OrderActionButtons
        order={{
          orderNumber: order.orderNumber,
          createdAt: String(order.createdAt),
          userName: order.user?.name,
          guestName: order.guestName,
          shippingAddress: order.shippingAddress,
          items: order.items,
          subtotal: order.subtotal,
          shippingCost: order.deliveryCharge,
          totalAmount: order.totalAmount,
          status: order.status,
        }}
      />
    </div>
  );
}
