-- SQL tests for supabase/migrations/20260930000000_execution_events.sql.
-- Plain PostgreSQL: run against a scratch database that already has the Supabase roles (anon, authenticated,
-- service_role) and has had the migration applied. Every block raises an exception on failure.
-- Never run this against the production project.

-- @test objects exist with RLS enabled and no policies
do $$ begin
  assert (select relrowsecurity from pg_class where oid = 'public.execution_events'::regclass), 'RLS off on execution_events';
  assert (select relrowsecurity from pg_class where oid = 'public.model_pricing'::regclass), 'RLS off on model_pricing';
  assert (select count(*) from pg_policies where tablename in ('execution_events','model_pricing')) = 0, 'unexpected policies';
  assert (select count(*) from pg_class where oid = 'public.execution_events_with_shadow_cost'::regclass) = 1, 'view missing';
end $$;

-- @test anon and authenticated are denied on both tables and the view
do $$
declare r text; t text; denied int := 0;
begin
  foreach r in array array['anon','authenticated'] loop
    foreach t in array array['execution_events','model_pricing','execution_events_with_shadow_cost'] loop
      begin
        execute format('set local role %I', r);
        execute format('select 1 from public.%I limit 1', t);
        reset role;
        raise exception 'role % could read %', r, t;
      exception when insufficient_privilege then
        reset role; denied := denied + 1;
      end;
    end loop;
    begin
      execute format('set local role %I', r);
      insert into public.execution_events (id, started_at, provider, purpose, outcome, usage_quality, billing_mode)
        values (gen_random_uuid(), now(), 'gemini', 'agent-reply', 'ok', 'not_reported', 'unknown');
      reset role;
      raise exception 'role % could insert', r;
    exception when insufficient_privilege then
      reset role; denied := denied + 1;
    end;
  end loop;
  assert denied = 8, format('expected 8 denials, got %s', denied);
end $$;

-- @test service_role can insert and read
do $$ begin
  set local role service_role;
  insert into public.execution_events (id, started_at, provider, purpose, outcome, usage_quality, billing_mode)
    values ('00000000-0000-0000-0000-0000000000a1', now(), 'gemini', 'chat-stream', 'ok', 'not_reported', 'unknown');
  assert (select count(*) from public.execution_events where id = '00000000-0000-0000-0000-0000000000a1') = 1;
  reset role;
  delete from public.execution_events;
end $$;

-- @test the same execution id cannot create two events
do $$ begin
  insert into public.execution_events (id, started_at, provider, purpose, outcome, usage_quality, billing_mode)
    values ('00000000-0000-0000-0000-0000000000b1', now(), 'gemini', 'chat-stream', 'ok', 'not_reported', 'unknown')
    on conflict (id) do nothing;
  insert into public.execution_events (id, started_at, provider, purpose, outcome, usage_quality, billing_mode)
    values ('00000000-0000-0000-0000-0000000000b1', now(), 'gemini', 'chat-stream', 'empty', 'not_reported', 'unknown')
    on conflict (id) do nothing;
  assert (select count(*) from public.execution_events) = 1, 'duplicate row created';
  assert (select outcome from public.execution_events) = 'ok', 'first write must win';
  begin
    insert into public.execution_events (id, started_at, provider, purpose, outcome, usage_quality, billing_mode)
      values ('00000000-0000-0000-0000-0000000000b1', now(), 'gemini', 'chat-stream', 'ok', 'not_reported', 'unknown');
    raise exception 'plain duplicate insert was accepted';
  exception when unique_violation then null; end;
  delete from public.execution_events;
end $$;

-- @test usage provenance must agree with the token numbers
do $$
declare bad int := 0;
begin
  -- ambiguous_proxy_zero may not carry numbers (a zero must never be stored as measured)
  begin
    insert into public.execution_events (id, started_at, provider, purpose, outcome, usage_quality, billing_mode, input_tokens, output_tokens, total_tokens)
      values (gen_random_uuid(), now(), 'claude-max', 'agent-reply', 'ok', 'ambiguous_proxy_zero', 'subscription', 0, 0, 0);
    raise exception 'stored proxy zeros as numbers';
  exception when check_violation then bad := bad + 1; end;
  -- provider_reported needs all three
  begin
    insert into public.execution_events (id, started_at, provider, purpose, outcome, usage_quality, billing_mode, input_tokens, output_tokens)
      values (gen_random_uuid(), now(), 'lm-studio', 'agent-reply', 'ok', 'provider_reported', 'local', 5, 2);
    raise exception 'provider_reported without a total accepted';
  exception when check_violation then bad := bad + 1; end;
  -- partial needs some but not all
  begin
    insert into public.execution_events (id, started_at, provider, purpose, outcome, usage_quality, billing_mode)
      values (gen_random_uuid(), now(), 'lm-studio', 'agent-reply', 'ok', 'partial', 'local');
    raise exception 'empty partial accepted';
  exception when check_violation then bad := bad + 1; end;
  begin
    insert into public.execution_events (id, started_at, provider, purpose, outcome, usage_quality, billing_mode, input_tokens, output_tokens, total_tokens)
      values (gen_random_uuid(), now(), 'lm-studio', 'agent-reply', 'ok', 'partial', 'local', 1, 2, 3);
    raise exception 'full partial accepted';
  exception when check_violation then bad := bad + 1; end;
  -- not_reported may not carry numbers
  begin
    insert into public.execution_events (id, started_at, provider, purpose, outcome, usage_quality, billing_mode, input_tokens)
      values (gen_random_uuid(), now(), 'gemini', 'chat-stream', 'ok', 'not_reported', 'unknown', 7);
    raise exception 'not_reported with tokens accepted';
  exception when check_violation then bad := bad + 1; end;
  -- ambiguous_proxy_zero is claude-max only
  begin
    insert into public.execution_events (id, started_at, provider, purpose, outcome, usage_quality, billing_mode)
      values (gen_random_uuid(), now(), 'lm-studio', 'agent-reply', 'ok', 'ambiguous_proxy_zero', 'local');
    raise exception 'proxy zero on lm-studio accepted';
  exception when check_violation then bad := bad + 1; end;
  assert bad = 6, format('expected 6 rejections, got %s', bad);
  -- a legitimate partial (input only) is accepted and stays partial
  insert into public.execution_events (id, started_at, provider, purpose, outcome, usage_quality, billing_mode, input_tokens)
    values ('00000000-0000-0000-0000-0000000000c1', now(), 'lm-studio', 'agent-reply', 'ok', 'partial', 'local', 42);
  assert (select output_tokens is null and total_tokens is null from public.execution_events where id = '00000000-0000-0000-0000-0000000000c1');
  delete from public.execution_events;
end $$;

-- @test direct cost is refused for subscription and local usage, and billing mode must match provider
do $$
declare bad int := 0;
begin
  begin
    insert into public.execution_events (id, started_at, provider, purpose, outcome, usage_quality, billing_mode, direct_cost_usd)
      values (gen_random_uuid(), now(), 'claude-max', 'agent-reply', 'ok', 'not_reported', 'subscription', 0.01);
    raise exception 'fake claude-max spend accepted';
  exception when check_violation then bad := bad + 1; end;
  begin
    insert into public.execution_events (id, started_at, provider, purpose, outcome, usage_quality, billing_mode, direct_cost_usd)
      values (gen_random_uuid(), now(), 'lm-studio', 'agent-reply', 'ok', 'not_reported', 'local', 0);
    raise exception 'lm-studio spend accepted';
  exception when check_violation then bad := bad + 1; end;
  begin
    insert into public.execution_events (id, started_at, provider, purpose, outcome, usage_quality, billing_mode)
      values (gen_random_uuid(), now(), 'claude-max', 'agent-reply', 'ok', 'not_reported', 'unknown');
    raise exception 'claude-max with unknown billing accepted';
  exception when check_violation then bad := bad + 1; end;
  begin
    insert into public.execution_events (id, started_at, provider, purpose, outcome, usage_quality, billing_mode)
      values (gen_random_uuid(), now(), 'gemini', 'chat-stream', 'ok', 'not_reported', 'subscription');
    raise exception 'gemini as subscription accepted';
  exception when check_violation then bad := bad + 1; end;
  assert bad = 4, format('expected 4 rejections, got %s', bad);
end $$;

-- @test OpenClaw model stays unknown; error fields, correlation and purpose are constrained
do $$
declare bad int := 0;
begin
  begin
    insert into public.execution_events (id, started_at, provider, purpose, outcome, usage_quality, billing_mode, model_requested)
      values (gen_random_uuid(), now(), 'openclaw', 'agent-reply', 'ok', 'not_reported', 'unknown', 'claude-opus-4-6');
    raise exception 'openclaw model accepted';
  exception when check_violation then bad := bad + 1; end;
  begin
    insert into public.execution_events (id, started_at, provider, purpose, outcome, usage_quality, billing_mode, model_reported)
      values (gen_random_uuid(), now(), 'openclaw', 'agent-reply', 'ok', 'not_reported', 'unknown', 'claude-sonnet-4');
    raise exception 'openclaw reported model accepted';
  exception when check_violation then bad := bad + 1; end;
  begin  -- error with no class
    insert into public.execution_events (id, started_at, provider, purpose, outcome, usage_quality, billing_mode)
      values (gen_random_uuid(), now(), 'gemini', 'chat-stream', 'error', 'not_reported', 'unknown');
    raise exception 'error without class accepted';
  exception when check_violation then bad := bad + 1; end;
  begin  -- class on a success
    insert into public.execution_events (id, started_at, provider, purpose, outcome, usage_quality, billing_mode, error_class)
      values (gen_random_uuid(), now(), 'gemini', 'chat-stream', 'ok', 'not_reported', 'unknown', 'http');
    raise exception 'class on success accepted';
  exception when check_violation then bad := bad + 1; end;
  begin  -- http status on a non-http error
    insert into public.execution_events (id, started_at, provider, purpose, outcome, usage_quality, billing_mode, error_class, http_status)
      values (gen_random_uuid(), now(), 'gemini', 'chat-stream', 'error', 'not_reported', 'unknown', 'timeout', 500);
    raise exception 'status on timeout accepted';
  exception when check_violation then bad := bad + 1; end;
  begin  -- correlation type without id
    insert into public.execution_events (id, started_at, provider, purpose, outcome, usage_quality, billing_mode, correlation_type)
      values (gen_random_uuid(), now(), 'gemini', 'chat-stream', 'ok', 'not_reported', 'unknown', 'job');
    raise exception 'untyped correlation accepted';
  exception when check_violation then bad := bad + 1; end;
  begin  -- unknown correlation type
    insert into public.execution_events (id, started_at, provider, purpose, outcome, usage_quality, billing_mode, correlation_type, correlation_id)
      values (gen_random_uuid(), now(), 'gemini', 'chat-stream', 'ok', 'not_reported', 'unknown', 'mission', 'x');
    raise exception 'mission correlation accepted';
  exception when check_violation then bad := bad + 1; end;
  begin  -- purpose outside the typed set
    insert into public.execution_events (id, started_at, provider, purpose, outcome, usage_quality, billing_mode)
      values (gen_random_uuid(), now(), 'gemini', 'mission-plan', 'ok', 'not_reported', 'unknown');
    raise exception 'invented purpose accepted';
  exception when check_violation then bad := bad + 1; end;
  assert bad = 8, format('expected 8 rejections, got %s', bad);
  -- valid shapes are accepted
  insert into public.execution_events (id, started_at, provider, purpose, outcome, usage_quality, billing_mode, error_class, http_status, correlation_type, correlation_id)
    values (gen_random_uuid(), now(), 'claude-max', 'job', 'error', 'not_reported', 'subscription', 'http', 502, 'job', 'abc');
  delete from public.execution_events;
end $$;

-- @test pricing: exactly the three verified records, each with provenance; a source-less price is refused
do $$ begin
  assert (select count(*) from public.model_pricing) = 3, 'expected 3 seeded prices';
  assert (select count(*) from public.model_pricing where source_url like 'https://platform.claude.com/%' and retrieved_on = date '2026-09-30') = 3, 'provenance missing';
  assert (select array_agg(model order by model) from public.model_pricing) = array['claude-haiku-4-5','claude-opus-4-6','claude-sonnet-4-6'];
  assert (select input_usd_per_mtok || '/' || output_usd_per_mtok from public.model_pricing where model = 'claude-opus-4-6') = '5.000000/25.000000';
  assert (select input_usd_per_mtok || '/' || output_usd_per_mtok from public.model_pricing where model = 'claude-sonnet-4-6') = '3.000000/15.000000';
  assert (select input_usd_per_mtok || '/' || output_usd_per_mtok from public.model_pricing where model = 'claude-haiku-4-5') = '1.000000/5.000000';
  begin
    insert into public.model_pricing (provider, model, input_usd_per_mtok, output_usd_per_mtok, source_url, retrieved_on)
      values ('anthropic', 'claude-x', 1, 1, '   ', date '2026-09-30');
    raise exception 'price without a source accepted';
  exception when check_violation then null; end;
  begin
    insert into public.model_pricing (provider, model, input_usd_per_mtok, output_usd_per_mtok, source_url)
      values ('anthropic', 'claude-x', 1, 1, 'https://example.com');
    raise exception 'price without a retrieval date accepted';
  exception when not_null_violation then null; end;
end $$;

-- @test shadow cost: correct arithmetic, labelled as a lower bound, never actual spend
do $$
declare v record;
begin
  insert into public.execution_events (id, started_at, provider, model_requested, model_reported, purpose, outcome, usage_quality, billing_mode, input_tokens, output_tokens, total_tokens) values
    ('00000000-0000-0000-0000-000000000d01', now(), 'claude-max', 'claude-opus-4-6',   'claude-opus-4',   'agent-reply', 'ok', 'provider_reported', 'subscription', 1000, 500, 1500),
    ('00000000-0000-0000-0000-000000000d02', now(), 'claude-max', 'claude-sonnet-4-6', 'claude-sonnet-4', 'agent-reply', 'ok', 'provider_reported', 'subscription', 10000, 2000, 12000),
    ('00000000-0000-0000-0000-000000000d03', now(), 'claude-max', 'claude-haiku-4-5',  'claude-haiku-4',  'agent-reply', 'ok', 'provider_reported', 'subscription', 2000, 1000, 3000);
  -- partial usage with input and output but no total is still priceable (the total is not needed and not derived)
  insert into public.execution_events (id, started_at, provider, model_requested, purpose, outcome, usage_quality, billing_mode, input_tokens, output_tokens) values
    ('00000000-0000-0000-0000-000000000d04', now(), 'claude-max', 'claude-sonnet-4-6', 'job', 'ok', 'partial', 'subscription', 1000000, 1000000);
  select * into v from public.execution_events_with_shadow_cost where id = '00000000-0000-0000-0000-000000000d01';
  assert v.shadow_cost_usd = 0.0175, format('opus shadow %s', v.shadow_cost_usd);
  assert v.shadow_cost_basis = 'list_price_equivalent_lower_bound_excludes_cache_tokens';
  assert v.shadow_pricing_source_url like 'https://platform.claude.com/%' and v.shadow_pricing_retrieved_on = date '2026-09-30';
  assert v.direct_cost_usd is null, 'direct cost must stay null';
  assert v.total_tokens = 1500, 'total must be exactly as recorded';
  assert (select shadow_cost_usd from public.execution_events_with_shadow_cost where id = '00000000-0000-0000-0000-000000000d02') = 0.06;
  assert (select shadow_cost_usd from public.execution_events_with_shadow_cost where id = '00000000-0000-0000-0000-000000000d03') = 0.007;
  assert (select shadow_cost_usd from public.execution_events_with_shadow_cost where id = '00000000-0000-0000-0000-000000000d04') = 18.0, 'partial input+output priced from the two numbers only';
  assert (select total_tokens is null from public.execution_events_with_shadow_cost where id = '00000000-0000-0000-0000-000000000d04'), 'view must not synthesize a total';
  -- the reported family label does not change pricing: the exact requested model does
  assert (select model_reported from public.execution_events_with_shadow_cost where id = '00000000-0000-0000-0000-000000000d01') = 'claude-opus-4';
  delete from public.execution_events;
end $$;

-- @test shadow cost stays NULL (unknown) whenever it cannot be defended
do $$
declare n int;
begin
  insert into public.execution_events (id, started_at, provider, model_requested, purpose, outcome, usage_quality, billing_mode, input_tokens, output_tokens, total_tokens, error_class) values
    -- ambiguous proxy zero: tokens are null
    ('00000000-0000-0000-0000-000000000e01', now(), 'claude-max', 'claude-opus-4-6', 'agent-reply', 'ok', 'ambiguous_proxy_zero', 'subscription', null, null, null, null),
    -- model with no pricing record
    ('00000000-0000-0000-0000-000000000e02', now(), 'claude-max', 'claude-opus-9-9', 'agent-reply', 'ok', 'provider_reported', 'subscription', 10, 10, 20, null),
    -- no requested model at all
    ('00000000-0000-0000-0000-000000000e03', now(), 'claude-max', null, 'agent-reply', 'ok', 'provider_reported', 'subscription', 10, 10, 20, null),
    -- output tokens missing
    ('00000000-0000-0000-0000-000000000e04', now(), 'claude-max', 'claude-opus-4-6', 'agent-reply', 'ok', 'partial', 'subscription', 10, null, null, null),
    -- usage not reported
    ('00000000-0000-0000-0000-000000000e05', now(), 'claude-max', 'claude-opus-4-6', 'agent-reply', 'ok', 'not_reported', 'subscription', null, null, null, null),
    -- failed call
    ('00000000-0000-0000-0000-000000000e06', now(), 'claude-max', 'claude-opus-4-6', 'agent-reply', 'error', 'provider_reported', 'subscription', 10, 10, 20, 'http'),
    -- empty completion
    ('00000000-0000-0000-0000-000000000e07', now(), 'claude-max', 'claude-opus-4-6', 'agent-reply', 'empty', 'provider_reported', 'subscription', 10, 10, 20, null),
    -- not the subscription provider
    ('00000000-0000-0000-0000-000000000e08', now(), 'lm-studio', 'claude-opus-4-6', 'agent-reply', 'ok', 'provider_reported', 'local', 10, 10, 20, null),
    ('00000000-0000-0000-0000-000000000e09', now(), 'gemini', 'claude-opus-4-6', 'chat-stream', 'ok', 'provider_reported', 'unknown', 10, 10, 20, null);
  select count(*) into n from public.execution_events_with_shadow_cost where shadow_cost_usd is not null or shadow_cost_basis is not null;
  assert n = 0, format('%s rows produced a shadow cost that should be unknown', n);
  assert (select count(*) from public.execution_events_with_shadow_cost) = 9;
  delete from public.execution_events;
end $$;

-- @test the pricing lookup requires provenance
do $$
declare bad int := 0;
begin
  -- the columns are NOT NULL / non-blank, so a price without provenance cannot exist to be joined
  assert (select count(*) from public.model_pricing where source_url is null or btrim(source_url) = '' or retrieved_on is null) = 0;
  assert (select is_nullable from information_schema.columns where table_name = 'model_pricing' and column_name = 'source_url') = 'NO';
  assert (select is_nullable from information_schema.columns where table_name = 'model_pricing' and column_name = 'retrieved_on') = 'NO';
end $$;
