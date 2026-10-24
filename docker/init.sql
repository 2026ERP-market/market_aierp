-- ====================================================================
-- Mart AI ERP - PostgreSQL Database Initial Schema
-- Based on: 수요예측 데이터 명세.md & Mart AI ERP Domain
-- ====================================================================

-- 1. 확장 기능 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. 마스터 테이블 생성
CREATE TABLE IF NOT EXISTS warehouses (
    warehouse_id VARCHAR(30) PRIMARY KEY,
    warehouse_name VARCHAR(100) NOT NULL,
    region_code VARCHAR(20) NOT NULL,
    address VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
    customer_id VARCHAR(30) PRIMARY KEY,
    customer_name VARCHAR(100) NOT NULL,
    customer_type VARCHAR(30) NOT NULL CHECK (customer_type IN ('retail', 'restaurant', 'wholesale', 'online')),
    region_code VARCHAR(20),
    segment VARCHAR(10) CHECK (segment IN ('A', 'B', 'C')),
    first_order_date DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS suppliers (
    supplier_id VARCHAR(30) PRIMARY KEY,
    supplier_name VARCHAR(100) NOT NULL,
    lead_time_days INTEGER NOT NULL DEFAULT 1 CHECK (lead_time_days >= 0),
    cutoff_time TIME DEFAULT '18:00:00',
    min_order_amount BIGINT NOT NULL DEFAULT 0,
    phone VARCHAR(30),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS items (
    item_id VARCHAR(30) PRIMARY KEY,
    item_name VARCHAR(150) NOT NULL,
    category_l VARCHAR(50) NOT NULL,
    category_m VARCHAR(50),
    category_s VARCHAR(50),
    uom VARCHAR(20) NOT NULL DEFAULT 'EA',
    pack_size NUMERIC(12, 3) NOT NULL DEFAULT 1.000,
    cost_price BIGINT NOT NULL DEFAULT 0,
    sale_price BIGINT NOT NULL DEFAULT 0,
    shelf_life_days INTEGER,
    launch_date DATE,
    discontinue_date DATE,
    substitute_group VARCHAR(50),
    safety_stock NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS supply_terms (
    item_id VARCHAR(30) NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,
    supplier_id VARCHAR(30) NOT NULL REFERENCES suppliers(supplier_id) ON DELETE CASCADE,
    is_primary BOOLEAN NOT NULL DEFAULT TRUE,
    lead_time_days INTEGER NOT NULL DEFAULT 1 CHECK (lead_time_days >= 0),
    moq NUMERIC(12, 3) NOT NULL DEFAULT 1.000,
    order_multiple NUMERIC(12, 3) NOT NULL DEFAULT 1.000,
    unit_cost BIGINT NOT NULL,
    order_days VARCHAR(50) DEFAULT 'MON,TUE,WED,THU,FRI',
    PRIMARY KEY (item_id, supplier_id)
);

-- 3. 트랜잭션 및 재고 관리
CREATE TABLE IF NOT EXISTS sales (
    id BIGSERIAL,
    sale_date DATE NOT NULL,
    order_id VARCHAR(50) NOT NULL,
    item_id VARCHAR(30) NOT NULL REFERENCES items(item_id),
    warehouse_id VARCHAR(30) NOT NULL REFERENCES warehouses(warehouse_id),
    customer_id VARCHAR(30) REFERENCES customers(customer_id),
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('offline', 'online', 'b2b')),
    qty NUMERIC(12, 3) NOT NULL,
    unit_price BIGINT NOT NULL,
    amount BIGINT NOT NULL,
    is_return BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (sale_date, id)
) PARTITION BY RANGE (sale_date);

-- 기본 파티션 생성
CREATE TABLE IF NOT EXISTS sales_default PARTITION OF sales DEFAULT;

CREATE TABLE IF NOT EXISTS inventory_daily (
    snapshot_date DATE NOT NULL,
    item_id VARCHAR(30) NOT NULL REFERENCES items(item_id),
    warehouse_id VARCHAR(30) NOT NULL REFERENCES warehouses(warehouse_id),
    on_hand_qty NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    available_qty NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    stockout_flag BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (snapshot_date, item_id, warehouse_id)
);

CREATE TABLE IF NOT EXISTS inventory_batches (
    batch_id VARCHAR(50) PRIMARY KEY,
    item_id VARCHAR(30) NOT NULL REFERENCES items(item_id),
    warehouse_id VARCHAR(30) NOT NULL REFERENCES warehouses(warehouse_id),
    expiry_date DATE NOT NULL,
    qty NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    received_date DATE NOT NULL DEFAULT CURRENT_DATE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS open_orders (
    order_id VARCHAR(50) NOT NULL,
    line_no INTEGER NOT NULL DEFAULT 1,
    customer_id VARCHAR(30) NOT NULL REFERENCES customers(customer_id),
    item_id VARCHAR(30) NOT NULL REFERENCES items(item_id),
    order_date DATE NOT NULL,
    requested_delivery_date DATE NOT NULL,
    qty NUMERIC(12, 3) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('confirmed', 'shipped', 'cancelled')),
    PRIMARY KEY (order_id, line_no)
);

CREATE TABLE IF NOT EXISTS purchase_orders (
    po_id VARCHAR(50) PRIMARY KEY,
    supplier_id VARCHAR(30) NOT NULL REFERENCES suppliers(supplier_id),
    order_date DATE NOT NULL,
    expected_date DATE NOT NULL,
    received_date DATE,
    total_amount BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL CHECK (status IN ('draft', 'ordered', 'partial', 'received', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_order_lines (
    po_id VARCHAR(50) NOT NULL REFERENCES purchase_orders(po_id) ON DELETE CASCADE,
    line_no INTEGER NOT NULL,
    item_id VARCHAR(30) NOT NULL REFERENCES items(item_id),
    order_qty NUMERIC(12, 3) NOT NULL,
    received_qty NUMERIC(12, 3) NOT NULL DEFAULT 0.000,
    unit_cost BIGINT NOT NULL,
    PRIMARY KEY (po_id, line_no)
);

-- 4. 외생 변수 테이블
CREATE TABLE IF NOT EXISTS promotions (
    promo_id VARCHAR(50) PRIMARY KEY,
    item_id VARCHAR(30) NOT NULL REFERENCES items(item_id),
    warehouse_id VARCHAR(30) REFERENCES warehouses(warehouse_id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    promo_type VARCHAR(30) NOT NULL CHECK (promo_type IN ('discount', 'one_plus_one', 'bundle', 'coupon', 'display')),
    regular_price BIGINT NOT NULL,
    promo_price BIGINT NOT NULL,
    discount_rate NUMERIC(5, 4) NOT NULL CHECK (discount_rate >= 0 AND discount_rate <= 1),
    CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS calendar (
    date DATE PRIMARY KEY,
    weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
    week_of_year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    is_holiday BOOLEAN NOT NULL DEFAULT FALSE,
    holiday_name VARCHAR(50),
    days_to_seollal INTEGER,
    days_to_chuseok INTEGER,
    is_payday BOOLEAN NOT NULL DEFAULT FALSE,
    season VARCHAR(20) NOT NULL CHECK (season IN ('spring', 'summer', 'autumn', 'winter'))
);

CREATE TABLE IF NOT EXISTS weather (
    date DATE NOT NULL,
    region_code VARCHAR(20) NOT NULL,
    temp_avg NUMERIC(4, 1),
    temp_min NUMERIC(4, 1),
    temp_max NUMERIC(4, 1),
    precipitation_mm NUMERIC(6, 1) NOT NULL DEFAULT 0.0,
    is_rain BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (date, region_code)
);

CREATE TABLE IF NOT EXISTS weather_forecast (
    issued_at TIMESTAMPTZ NOT NULL,
    target_date DATE NOT NULL,
    region_code VARCHAR(20) NOT NULL,
    source VARCHAR(20) NOT NULL CHECK (source IN ('short', 'mid', 'normal')),
    temp_max NUMERIC(4, 1),
    temp_min NUMERIC(4, 1),
    pop NUMERIC(5, 4) CHECK (pop >= 0 AND pop <= 1),
    pcp_mm NUMERIC(6, 1),
    PRIMARY KEY (issued_at, target_date, region_code)
);

CREATE TABLE IF NOT EXISTS events (
    event_id VARCHAR(50) PRIMARY KEY,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    item_id VARCHAR(30) REFERENCES items(item_id),
    warehouse_id VARCHAR(30) REFERENCES warehouses(warehouse_id),
    event_type VARCHAR(30) NOT NULL CHECK (event_type IN ('one_off_bulk', 'system_down', 'supply_issue', 'competitor', 'media', 'weather_disaster')),
    note TEXT NOT NULL,
    CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS market_index (
    month VARCHAR(7) NOT NULL,
    index_name VARCHAR(30) NOT NULL,
    value NUMERIC(6, 2) NOT NULL,
    PRIMARY KEY (month, index_name)
);

-- 5. AI 예측 및 자동 발주 추천 테이블
CREATE TABLE IF NOT EXISTS forecast (
    forecast_id BIGSERIAL PRIMARY KEY,
    run_date DATE NOT NULL,
    target_date DATE NOT NULL,
    item_id VARCHAR(30) NOT NULL REFERENCES items(item_id),
    warehouse_id VARCHAR(30) NOT NULL REFERENCES warehouses(warehouse_id),
    yhat NUMERIC(12, 3) NOT NULL,
    yhat_p10 NUMERIC(12, 3),
    yhat_p90 NUMERIC(12, 3),
    model_version VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_forecast_grain UNIQUE (run_date, target_date, item_id, warehouse_id)
);

CREATE TABLE IF NOT EXISTS order_recommendations (
    rec_id VARCHAR(50) PRIMARY KEY,
    recommend_date DATE NOT NULL,
    item_id VARCHAR(30) NOT NULL REFERENCES items(item_id),
    warehouse_id VARCHAR(30) NOT NULL REFERENCES warehouses(warehouse_id),
    supplier_id VARCHAR(30) NOT NULL REFERENCES suppliers(supplier_id),
    current_stock NUMERIC(12, 3) NOT NULL,
    forecast_demand NUMERIC(12, 3) NOT NULL,
    safety_stock NUMERIC(12, 3) NOT NULL,
    recommended_qty NUMERIC(12, 3) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'rejected', 'ordered')),
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_sales_lookup ON sales (item_id, warehouse_id, sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales (sale_date);
CREATE INDEX IF NOT EXISTS idx_inv_daily_lookup ON inventory_daily (item_id, warehouse_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_inv_batches_expiry ON inventory_batches (expiry_date);
CREATE INDEX IF NOT EXISTS idx_forecast_target ON forecast (target_date, item_id, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_order_rec_date_status ON order_recommendations (recommend_date, status);

-- 7. 학습 및 분석용 일별 판매 집계 뷰 (결측 0 보정 분석용 기초)
CREATE OR REPLACE VIEW v_daily_sales_aggregate AS
SELECT 
    s.sale_date,
    s.item_id,
    s.warehouse_id,
    COALESCE(SUM(CASE WHEN NOT s.is_return THEN s.qty ELSE -s.qty END), 0) AS net_qty,
    COALESCE(SUM(s.amount), 0) AS total_amount,
    COUNT(DISTINCT s.order_id) AS order_count
FROM sales s
GROUP BY s.sale_date, s.item_id, s.warehouse_id;
