import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Order } from "@/features/order/types";
import { Loader2, X, Pencil } from "lucide-react";
import { calculateItemAddOnCost, colorHasAddOn } from "@/lib/utils";

type ShippingOrder = Order & {
  shippingMethod?: { name: string; duration: string } | null;
};

interface BulkBookCourierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: ShippingOrder[];
  onConfirm: (
    costPrices: { orderItemId: string; costPrice: number }[],
    shippingCosts: { orderId: string; shippingCost: number }[],
    bookedOrderIds: string[]
  ) => void;
  isBooking: boolean;
}

export function BulkBookCourierDialog({
  open,
  onOpenChange,
  orders,
  onConfirm,
  isBooking
}: BulkBookCourierDialogProps) {
  const [localOrders, setLocalOrders] = useState<ShippingOrder[]>([]);
  const [costPricesMap, setCostPricesMap] = useState<Record<string, string>>({});
  const [addOnCostsMap, setAddOnCostsMap] = useState<Record<string, string>>({});
  const [shippingCostsMap, setShippingCostsMap] = useState<Record<string, string>>({});
  const [editingItems, setEditingItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- seeds the dialog's editable local copy of `orders` each time it opens; local edits must not leak back until saved.
      setLocalOrders(orders);
      const initialMap: Record<string, string> = {};
      const initialAddOnMap: Record<string, string> = {};
      const initialCostsMap: Record<string, string> = {};
      orders.forEach(order => {
        initialCostsMap[order.id] = order.shippingCost.toString();
        order.items?.forEach(item => {
          if (item.costPrice !== null && item.costPrice !== undefined) {
            initialMap[item.id] = item.costPrice.toString();
          }
          const suggestedAddOnCost = calculateItemAddOnCost(item.color, item.product?.addOns);
          if (suggestedAddOnCost > 0) {
            initialAddOnMap[item.id] = suggestedAddOnCost.toString();
          }
        });
      });
      setCostPricesMap(initialMap);
      setAddOnCostsMap(initialAddOnMap);
      setShippingCostsMap(initialCostsMap);
      setEditingItems({});
    }
  }, [open, orders]);

  const handleConfirm = () => {
    const itemIds = new Set<string>();
    localOrders.forEach(order => order.items?.forEach(item => itemIds.add(item.id)));

    const payload = Array.from(itemIds)
      .map((id) => {
        const baseStr = costPricesMap[id];
        const addOnStr = addOnCostsMap[id];
        const base = baseStr && baseStr.trim() !== "" && !isNaN(Number(baseStr)) ? Number(baseStr) : 0;
        const addOn = addOnStr && addOnStr.trim() !== "" && !isNaN(Number(addOnStr)) ? Number(addOnStr) : 0;
        return { orderItemId: id, costPrice: base + addOn, hasValue: Boolean(baseStr) || Boolean(addOnStr) };
      })
      .filter(({ hasValue }) => hasValue)
      .map(({ orderItemId, costPrice }) => ({ orderItemId, costPrice }));

    const shippingCostsPayload = Object.entries(shippingCostsMap)
      .filter(([id, costStr]) => {
        const existsInRemainingOrders = localOrders.some(order => order.id === id);
        return existsInRemainingOrders && costStr.trim() !== "" && !isNaN(Number(costStr));
      })
      .map(([id, costStr]) => ({
        orderId: id,
        shippingCost: Number(costStr)
      }));
    
    const bookedOrderIds = localOrders.map(o => o.id);
    onConfirm(payload, shippingCostsPayload, bookedOrderIds);
  };

  const handlePriceChange = (id: string, value: string) => {
    setCostPricesMap(prev => ({ ...prev, [id]: value }));
  };

  const handleAddOnPriceChange = (id: string, value: string) => {
    setAddOnCostsMap(prev => ({ ...prev, [id]: value }));
  };

  const handleShippingCostChange = (id: string, value: string) => {
    setShippingCostsMap(prev => ({ ...prev, [id]: value }));
  };

  const handleRemoveOrder = (orderId: string) => {
    setLocalOrders(prev => prev.filter(o => o.id !== orderId));
  };

  const startEditing = (itemId: string, currentCost: number) => {
    setCostPricesMap(prev => ({ ...prev, [itemId]: currentCost.toString() }));
    setEditingItems(prev => ({ ...prev, [itemId]: true }));
  };

  const itemsCount = localOrders.reduce((acc, order) => acc + (order.items?.length || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Booking: Bought Prices</DialogTitle>
          <DialogDescription>
            You are about to book {localOrders.length} orders containing {itemsCount} items.
            Please verify or enter the bought prices (cost prices) and shipping costs for the orders below to accurately calculate your profit.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 -mx-4 px-4 overflow-y-auto">
          <div className={`space-y-6 pb-4 ${localOrders.length > 3 ? "max-h-[500px] overflow-y-auto pr-2" : ""}`}>
            {localOrders.map(order => (
              <div key={order.id} className="space-y-3 border rounded-xl p-4 bg-muted/20">
                <div className="flex justify-between items-center border-b pb-2">
                  <div>
                    <h4 className="font-semibold">{order.orderNumber}</h4>
                    <p className="text-xs text-muted-foreground">{order.guestName || order.user?.name || "Customer"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground font-medium">Ship Cost:</span>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        className="h-7 w-20 text-xs px-2 rounded-md"
                        value={shippingCostsMap[order.id] || ""}
                        onChange={(e) => handleShippingCostChange(order.id, e.target.value)}
                      />
                    </div>
                    <span className="text-sm font-medium">৳{order.totalAmount.toLocaleString()}</span>
                    {localOrders.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                        onClick={() => handleRemoveOrder(order.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-3">
                  {order.items?.map(item => {
                    return (
                    <div key={item.id} className="flex items-center gap-3">
                      <div className="h-10 w-10 shrink-0 bg-muted rounded-md overflow-hidden">
                        {item.product?.images?.[0] ? (
                          <img src={item.product.images[0]} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full bg-slate-100 dark:bg-slate-800" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.product?.name || "Unknown Product"}</p>
                        <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                      </div>
                      <div className="w-28 shrink-0 space-y-1">
                        {item.costPrice !== null && item.costPrice !== undefined && !editingItems[item.id] ? (
                          <div className="flex h-8 w-full items-center justify-between pl-2 pr-1 text-sm font-medium text-muted-foreground border rounded-md bg-muted/50 gap-1.5">
                            <span>৳{item.costPrice}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded"
                              onClick={() => startEditing(item.id, item.costPrice!)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <Input
                              type="number"
                              placeholder="Bought Price"
                              className="h-8 text-sm"
                              value={costPricesMap[item.id] || ""}
                              onChange={(e) => handlePriceChange(item.id, e.target.value)}
                            />
                            {colorHasAddOn(item.color) && (
                              <Input
                                type="number"
                                placeholder="Add-on cost"
                                className="h-8 text-sm"
                                value={addOnCostsMap[item.id] || ""}
                                onChange={(e) => handleAddOnPriceChange(item.id, e.target.value)}
                              />
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="mt-4 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBooking}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isBooking} className="gap-2">
            {isBooking ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isBooking ? "Booking..." : "Confirm Booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
