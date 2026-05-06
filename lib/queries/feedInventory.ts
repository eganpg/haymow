// Feed inventory — the system that tracks what's in the barn and what it cost.
// Two tables back this: feed_inventory (current stock + cost-per-unit) and
// feed_purchases (restock history). When the user logs feed usage during a milking
// session or egg collection, we deduct from quantity_on_hand and snapshot the
// cost_per_unit onto the feed_entries row so future cost analysis isn't broken
// by later price changes.

import { supabase } from '../supabase';

// One row per kind of feed in the barn (e.g. "Purina Layena", "Coastal Bermuda Hay").
// quantity_on_hand is the live stock count — increases on restock, decreases on usage.
// cost_per_unit gets recalculated on each restock (total_cost / quantity_purchased).
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

// One row per restock event. Lets us show the "purchase history" view on a feed
// item and trace cost trends over time. cost_per_unit here is the per-purchase cost,
// distinct from the rolling cost_per_unit on feed_inventory.
export type FeedPurchase = {
  id: string;
  feed_inventory_id: string;
  purchase_date: string;
  quantity_purchased: number;
  total_cost: number | null;
  cost_per_unit: number | null;
};

// Full inventory list for a user, alphabetized by name.
// Used by the Feed Management screen.
export async function getFeedInventory(userId: string): Promise<FeedInventoryItem[]> {
  const { data, error } = await supabase
    .from('feed_inventory')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Add a new feed kind to the inventory. Quantity and cost are optional — the user
// can register a feed type before they've actually bought any (useful for templates).
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

// Edit an existing feed item's metadata (name, type, unit, low-stock threshold).
// Doesn't touch quantity or cost — those are managed by restock/usage flows so
// that the audit trail stays consistent.
export async function updateFeedItem(params: {
  id: string;
  name: string;
  feedType: string;
  unit: string;
  lowStockAlert?: number | null;
}): Promise<void> {
  const { error } = await supabase
    .from('feed_inventory')
    .update({
      name: params.name,
      feed_type: params.feedType,
      unit: params.unit,
      low_stock_alert: params.lowStockAlert ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id);
  if (error) throw error;
}

// Delete a feed item — but only if it has never been used in a feed entry.
// Why: deleting an item that's referenced by feed_entries would either break those
// rows or silently lose the cost-history lineage. We refuse instead and surface a
// clear error. Purchase history (feed_purchases) belongs to the inventory row, so
// we delete it as part of the same operation.
export async function deleteFeedItem(feedInventoryId: string): Promise<void> {
  // Block the delete if any feed_entries reference this item.
  const { count, error: countError } = await supabase
    .from('feed_entries')
    .select('id', { count: 'exact', head: true })
    .eq('feed_inventory_id', feedInventoryId);
  if (countError) throw countError;
  if (count && count > 0) {
    throw new Error(`This feed has ${count} usage ${count === 1 ? 'entry' : 'entries'} logged — can't delete.`);
  }

  // Wipe purchase history first so the parent delete doesn't fail on the FK reference.
  const { error: purchasesError } = await supabase
    .from('feed_purchases')
    .delete()
    .eq('feed_inventory_id', feedInventoryId);
  if (purchasesError) throw purchasesError;

  const { error } = await supabase
    .from('feed_inventory')
    .delete()
    .eq('id', feedInventoryId);
  if (error) throw error;
}

// Restock a feed item: increase quantity_on_hand and (if a cost was provided)
// refresh the running cost_per_unit. Also writes a row to feed_purchases so the
// purchase history is preserved.
// totalCost is optional — if the user just wants to record "I added 50 lbs" without
// a cost, that's allowed. We just won't update cost_per_unit in that case.
export async function restockFeedItem(params: {
  userId: string;
  feedInventoryId: string;
  quantityPurchased: number;
  totalCost?: number;
}): Promise<void> {
  // If we have a cost, derive the per-unit price for this purchase.
  // Note: this becomes the new "current" cost_per_unit on the inventory row, replacing
  // any previous value. That's intentional — most recent purchase wins for cost analysis.
  const costPerUnit = params.totalCost
    ? params.totalCost / params.quantityPurchased
    : null;

  // Read current stock so we can add to it. We don't use a single SQL UPDATE with
  // an expression because Supabase's JS client doesn't support expressions like
  // `quantity_on_hand = quantity_on_hand + X` cleanly.
  const { data: current, error: fetchError } = await supabase
    .from('feed_inventory')
    .select('quantity_on_hand')
    .eq('id', params.feedInventoryId)
    .single();
  if (fetchError) throw fetchError;

  const newQuantity = (current.quantity_on_hand ?? 0) + params.quantityPurchased;

  // Update the inventory row. The spread { ...(costPerUnit !== null ? { cost_per_unit } : {}) }
  // pattern means "only include cost_per_unit in the update if we computed one" —
  // skipping the field entirely preserves the previous cost on cost-less restocks.
  const { error: updateError } = await supabase
    .from('feed_inventory')
    .update({
      quantity_on_hand: newQuantity,
      ...(costPerUnit !== null ? { cost_per_unit: costPerUnit } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.feedInventoryId);
  if (updateError) throw updateError;

  // Record the purchase event for history.
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

// Subtract feed used during a session from the on-hand stock.
// Floor at 0 so logging "I fed 10 lbs" when only 5 lbs are recorded doesn't go
// negative — likely a tracking error, not a real overdraft.
// Called by logFeedUsage below; not usually called directly.
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

// Inverse of deductFeedUsage — adds quantity back to inventory.
// Used when the user edits or deletes a milking session: we revert the original
// feed deduction first, then either re-deduct the new amount (edit) or leave it
// reverted (delete). Keeps inventory honest across edits.
export async function restoreFeedUsage(feedInventoryId: string, amountToRestore: number): Promise<void> {
  const { data: current, error: fetchError } = await supabase
    .from('feed_inventory')
    .select('quantity_on_hand')
    .eq('id', feedInventoryId)
    .single();
  if (fetchError) throw fetchError;

  const newQuantity = (current.quantity_on_hand ?? 0) + amountToRestore;

  const { error } = await supabase
    .from('feed_inventory')
    .update({ quantity_on_hand: newQuantity, updated_at: new Date().toISOString() })
    .eq('id', feedInventoryId);
  if (error) throw error;
}

// The main "log feed usage" entry point. Called whenever the user logs feed
// alongside a milking session, egg collection, or batch event. Two side effects:
//   1. Inserts a row into feed_entries (the audit trail of what was fed when).
//   2. Deducts the amount from feed_inventory.quantity_on_hand.
// We snapshot feed_type, unit, and cost_per_unit onto the feed_entries row at the
// moment of logging so historical cost analysis isn't broken by later inventory edits.
// milkingSessionId is the link added in migration 003 — it ties dairy feed to the
// session so the feed→yield correlation query can join cleanly.
export async function logFeedUsage(params: {
  userId: string;
  feedInventoryId: string;
  animalId?: string;
  flockId?: string;
  batchId?: string;
  milkingSessionId?: string;
  amount: number;
  entryTime?: string; // ISO; defaults to now
}): Promise<void> {
  // Read the current inventory metadata so we can snapshot it onto the feed entry.
  const { data: item, error: fetchError } = await supabase
    .from('feed_inventory')
    .select('feed_type, unit, cost_per_unit')
    .eq('id', params.feedInventoryId)
    .single();
  if (fetchError) throw fetchError;

  // Insert the feed_entries row. Exactly one of animal_id/flock_id/batch_id is
  // expected to be set by the caller; the polymorphic shape lets feed entries
  // attach to any of the three animal types.
  const { error: entryError } = await supabase
    .from('feed_entries')
    .insert({
      user_id: params.userId,
      animal_id: params.animalId ?? null,
      flock_id: params.flockId ?? null,
      batch_id: params.batchId ?? null,
      feed_inventory_id: params.feedInventoryId,
      milking_session_id: params.milkingSessionId ?? null,
      entry_time: params.entryTime ?? new Date().toISOString(),
      feed_type: item.feed_type,
      amount: params.amount,
      unit: item.unit,
      cost_per_unit: item.cost_per_unit,
    });
  if (entryError) throw entryError;

  // Pull the amount off the inventory.
  await deductFeedUsage(params.feedInventoryId, params.amount);
}

// Slim shape of a feed entry — just what the edit-session flow needs to revert
// inventory and re-render the UI. Kept narrow so we don't accidentally couple to
// the full feed_entries row.
export type SessionFeedEntry = {
  id: string;
  feed_inventory_id: string | null;
  amount: number;
  unit: string | null;
  feed_type: string | null;
  cost_per_unit: number | null;
};

// All feed entries linked to a given milking session. Used by the edit/delete flows
// in queries/milking.ts to revert inventory before re-applying or removing feed.
export async function getFeedEntriesForSession(milkingSessionId: string): Promise<SessionFeedEntry[]> {
  const { data, error } = await supabase
    .from('feed_entries')
    .select('id, feed_inventory_id, amount, unit, feed_type, cost_per_unit')
    .eq('milking_session_id', milkingSessionId)
    .order('entry_time', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Restock history for a feed item, newest first. Powers the "Purchase History"
// list on the feed item detail screen.
export async function getPurchaseHistory(feedInventoryId: string): Promise<FeedPurchase[]> {
  const { data, error } = await supabase
    .from('feed_purchases')
    .select('*')
    .eq('feed_inventory_id', feedInventoryId)
    .order('purchase_date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
