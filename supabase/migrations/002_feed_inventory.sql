-- Feed inventory table
-- Tracks feed types the user keeps on hand, quantity remaining, and cost per unit

create table feed_inventory (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users not null,
  name           text not null,           -- "Purina Strategy grain", "Coastal hay", "Layer pellets"
  feed_type      text not null,
  -- dairy:      'grain' | 'hay' | 'mineral' | 'pasture' | 'other'
  -- layers:     'layer-pellet' | 'scratch' | 'oyster-shell' | 'other'
  -- meat birds: 'chick-starter' | 'grower' | 'finisher' | 'other'
  unit           text not null,           -- 'lbs' | 'bags' | 'flakes' | 'oz'
  quantity_on_hand numeric(10,2) not null default 0,
  cost_per_unit  numeric(8,4),            -- $/unit — updated when restocked
  low_stock_alert numeric(8,2),           -- optional: alert when quantity falls below this
  notes          text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

alter table feed_inventory enable row level security;
create policy "users access own feed inventory"
  on feed_inventory for all using (user_id = auth.uid());

-- Add feed_inventory_id to feed_entries so usage traces back to inventory
alter table feed_entries
  add column feed_inventory_id uuid references feed_inventory;

-- Feed purchases — log every time you buy/restock feed
create table feed_purchases (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references auth.users not null,
  feed_inventory_id   uuid references feed_inventory not null,
  purchase_date       date not null default current_date,
  quantity_purchased  numeric(10,2) not null,
  total_cost          numeric(8,2),       -- what you paid for this batch
  cost_per_unit       numeric(8,4),       -- calculated: total_cost / quantity_purchased
  notes               text,
  created_at          timestamptz default now()
);

alter table feed_purchases enable row level security;
create policy "users access own feed purchases"
  on feed_purchases for all using (user_id = auth.uid());
