import { supabase } from '../supabase';

export type FeedInventoryItem = {
  id: string;
  user_id: string;
  name: string;
  feed_type: string;
  unit: string;
  quantity_on_hand: number;
  cost_per_unit: number | null;
  low_stock_alert: number | null;
  notes: string | null;
  updated_at: string;
};

export type FeedPurchase = {
  id: string;
  feed_inventory_id: string;
  purchase_date: string;
  quantity_purchased: number;
  total_cost: number | null;
  cost_per_unit: number | null;
};

export async function getFeedInventory(userId: string): Promise<FeedInventoryItem[]> {
  const { data, error } = await supabase
    .from('feed_inventory')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createFeedItem(params: {
  userId: string;
  name: string;
  feedType: string;
  unit: string;
  quantityOnHand?: number;
  costPerUnit?: number;
  lowStockAlert?: number;
  notes?: string;
}): Promise<FeedInventoryItem> {
  const { data, error } = await supabase
    .from('feed_inventory')
    .insert({
      user_id: params.userId,
      name: params.name,
      feed_type: params.feedType,
      unit: params.unit,
      quantity_on_hand: params.quantityOnHand ?? 0,
      cost_per_unit: params.costPerUnit ?? null,
      low_stock_alert: params.lowStockAlert ?? null,
      notes: params.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Log a purchase: adds quantity to inventory and updates cost_per_unit
export async function restockFeedItem(params: {
  userId: string;
  feedInventoryId: string;
  quantityPurchased: number;
  totalCost?: number;
}): Promise<void> {
  const costPerUnit = params.totalCost
    ? params.totalCost / params.quantityPurchased
    : null;

  // Fetch current quantity
  const { data: current, error: fetchError } = await supabase
    .from('feed_inventory')
    .select('quantity_on_hand')
    .eq('id', params.feedInventoryId)
    .single();
  if (fetchError) throw fetchError;

  const newQuantity = (current.quantity_on_hand ?? 0) + params.quantityPurchased;

  // Update inventory
  const { error: updateError } = await supabase
    .from('feed_inventory')
    .update({
      quantity_on_hand: newQuantity,
      ...(costPerUnit !== null ? { cost_per_unit: costPerUnit } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.feedInventoryId);
  if (updateError) throw updateError;

  // Log the purchase
  const { error: purchaseError } = await supabase
    .from('feed_purchases')
    .insert({
      user_id: params.userId,
      feed_inventory_id: params.feedInventoryId,
      purchase_date: new Date().toISOString().split('T')[0],
      quantity_purchased: params.quantityPurchased,
      total_cost: params.totalCost ?? null,
      cost_per_unit: costPerUnit,
    });
  if (purchaseError) throw purchaseError;
}

// Deduct usage from inventory quantity
export async function deductFeedUsage(feedInventoryId: string, amountUsed: number): Promise<void> {
  const { data: current, error: fetchError } = await supabase
    .from('feed_inventory')
    .select('quantity_on_hand')
    .eq('id', feedInventoryId)
    .single();
  if (fetchError) throw fetchError;

  const newQuantity = Math.max(0, (current.quantity_on_hand ?? 0) - amountUsed);

  const { error } = await supabase
    .from('feed_inventory')
    .update({ quantity_on_hand: newQuantity, updated_at: new Date().toISOString() })
    .eq('id', feedInventoryId);
  if (error) throw error;
}

export async function logFeedUsage(params: {
  userId: string;
  feedInventoryId: string;
  animalId?: string;
  flockId?: string;
  batchId?: string;
  amount: number;
}): Promise<void> {
  const { data: item, error: fetchError } = await supabase
    .from('feed_inventory')
    .select('feed_type, unit, cost_per_unit')
    .eq('id', params.feedInventoryId)
    .single();
  if (fetchError) throw fetchError;

  // Write feed entry
  const { error: entryError } = await supabase
    .from('feed_entries')
    .insert({
      user_id: params.userId,
      animal_id: params.animalId ?? null,
      flock_id: params.flockId ?? null,
      batch_id: params.batchId ?? null,
      feed_inventory_id: params.feedInventoryId,
      entry_time: new Date().toISOString(),
      feed_type: item.feed_type,
      amount: params.amount,
      unit: item.unit,
      cost_per_unit: item.cost_per_unit,
    });
  if (entryError) throw entryError;

  // Deduct from inventory
  await deductFeedUsage(params.feedInventoryId, params.amount);
}

export async function getPurchaseHistory(feedInventoryId: string): Promise<FeedPurchase[]> {
  const { data, error } = await supabase
    .from('feed_purchases')
    .select('*')
    .eq('feed_inventory_id', feedInventoryId)
    .order('purchase_date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
