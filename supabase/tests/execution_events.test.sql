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
    values (gen_random_uuid(), now(), 'claude-max', 'job', 'error', 'not_reported', 'subscription', 'http', 502, 'job', '5d6f3c0e-1c1e-4b1e-9d3a-0a1b2c3d4e5f');
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
  -- Claude Max rows as the app now writes them: input/output present, total ALWAYS null, quality "partial".
  insert into public.execution_events (id, started_at, provider, model_requested, model_reported, purpose, outcome, usage_quality, billing_mode, input_tokens, output_tokens) values
    ('00000000-0000-0000-0000-000000000d01', '2026-10-15T12:00:00Z', 'claude-max', 'claude-opus-4-6',   'claude-opus-4',   'agent-reply', 'ok', 'partial', 'subscription', 1000, 500),
    ('00000000-0000-0000-0000-000000000d02', '2026-10-15T12:00:00Z', 'claude-max', 'claude-sonnet-4-6', 'claude-sonnet-4', 'agent-reply', 'ok', 'partial', 'subscription', 10000, 2000),
    ('00000000-0000-0000-0000-000000000d03', '2026-10-15T12:00:00Z', 'claude-max', 'claude-haiku-4-5',  'claude-haiku-4',  'agent-reply', 'ok', 'partial', 'subscription', 2000, 1000),
    ('00000000-0000-0000-0000-000000000d04', '2026-10-15T12:00:00Z', 'claude-max', 'claude-sonnet-4-6', null,              'job',         'ok', 'partial', 'subscription', 1000000, 1000000);
  select * into v from public.execution_events_with_shadow_cost where id = '00000000-0000-0000-0000-000000000d01';
  assert v.shadow_cost_usd = 0.0175, format('opus shadow %s', v.shadow_cost_usd);
  assert v.shadow_cost_basis = 'list_price_equivalent_lower_bound_excludes_cache_tokens';
  assert v.shadow_pricing_source_url like 'https://platform.claude.com/%' and v.shadow_pricing_retrieved_on = date '2026-09-30';
  assert v.direct_cost_usd is null, 'direct cost must stay null';
  assert v.total_tokens is null, 'the view must never synthesize a total';
  assert (select shadow_cost_usd from public.execution_events_with_shadow_cost where id = '00000000-0000-0000-0000-000000000d02') = 0.06;
  assert (select shadow_cost_usd from public.execution_events_with_shadow_cost where id = '00000000-0000-0000-0000-000000000d03') = 0.007;
  assert (select shadow_cost_usd from public.execution_events_with_shadow_cost where id = '00000000-0000-0000-0000-000000000d04') = 18.0;
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
    ('00000000-0000-0000-0000-000000000e01', '2026-10-15T12:00:00Z', 'claude-max', 'claude-opus-4-6', 'agent-reply', 'ok', 'ambiguous_proxy_zero', 'subscription', null, null, null, null),
    -- model with no pricing record
    ('00000000-0000-0000-0000-000000000e02', '2026-10-15T12:00:00Z', 'claude-max', 'claude-opus-9-9', 'agent-reply', 'ok', 'partial', 'subscription', 10, 10, null, null),
    -- no requested model at all
    ('00000000-0000-0000-0000-000000000e03', '2026-10-15T12:00:00Z', 'claude-max', null, 'agent-reply', 'ok', 'partial', 'subscription', 10, 10, null, null),
    -- output tokens missing (a zero output was dropped as untrusted)
    ('00000000-0000-0000-0000-000000000e04', '2026-10-15T12:00:00Z', 'claude-max', 'claude-opus-4-6', 'agent-reply', 'ok', 'partial', 'subscription', 10, null, null, null),
    -- input tokens missing (a zero input was dropped as untrusted)
    ('00000000-0000-0000-0000-000000000e0a', '2026-10-15T12:00:00Z', 'claude-max', 'claude-opus-4-6', 'agent-reply', 'ok', 'partial', 'subscription', null, 25, null, null),
    -- usage not reported
    ('00000000-0000-0000-0000-000000000e05', '2026-10-15T12:00:00Z', 'claude-max', 'claude-opus-4-6', 'agent-reply', 'ok', 'not_reported', 'subscription', null, null, null, null),
    -- failed call
    ('00000000-0000-0000-0000-000000000e06', '2026-10-15T12:00:00Z', 'claude-max', 'claude-opus-4-6', 'agent-reply', 'error', 'partial', 'subscription', 10, 10, null, 'http'),
    -- empty completion
    ('00000000-0000-0000-0000-000000000e07', '2026-10-15T12:00:00Z', 'claude-max', 'claude-opus-4-6', 'agent-reply', 'empty', 'partial', 'subscription', 10, 10, null, null),
    -- not the subscription provider
    ('00000000-0000-0000-0000-000000000e08', '2026-10-15T12:00:00Z', 'lm-studio', 'claude-opus-4-6', 'agent-reply', 'ok', 'provider_reported', 'local', 10, 10, 20, null),
    ('00000000-0000-0000-0000-000000000e09', '2026-10-15T12:00:00Z', 'gemini', 'claude-opus-4-6', 'chat-stream', 'ok', 'provider_reported', 'unknown', 10, 10, 20, null);
  select count(*) into n from public.execution_events_with_shadow_cost where shadow_cost_usd is not null or shadow_cost_basis is not null;
  assert n = 0, format('%s rows produced a shadow cost that should be unknown', n);
  assert (select count(*) from public.execution_events_with_shadow_cost) = 10;
  delete from public.execution_events;
end $$;

-- @test Claude Max rows never hold a total or a zero input/output; other providers keep theirs
do $$
declare bad int := 0;
begin
  begin  -- a total (the proxy synthesizes it)
    insert into public.execution_events (id, started_at, provider, purpose, outcome, usage_quality, billing_mode, input_tokens, output_tokens, total_tokens)
      values (gen_random_uuid(), now(), 'claude-max', 'agent-reply', 'ok', 'provider_reported', 'subscription', 5, 2, 7);
    raise exception 'claude-max total accepted';
  exception when check_violation then bad := bad + 1; end;
  begin  -- zero input (a fabricated zero)
    insert into public.execution_events (id, started_at, provider, purpose, outcome, usage_quality, billing_mode, input_tokens, output_tokens)
      values (gen_random_uuid(), now(), 'claude-max', 'agent-reply', 'ok', 'partial', 'subscription', 0, 50);
    raise exception 'claude-max zero input accepted';
  exception when check_violation then bad := bad + 1; end;
  begin  -- zero output
    insert into public.execution_events (id, started_at, provider, purpose, outcome, usage_quality, billing_mode, input_tokens, output_tokens)
      values (gen_random_uuid(), now(), 'claude-max', 'agent-reply', 'ok', 'partial', 'subscription', 50, 0);
    raise exception 'claude-max zero output accepted';
  exception when check_violation then bad := bad + 1; end;
  begin  -- the old all-zero row stored as measured
    insert into public.execution_events (id, started_at, provider, purpose, outcome, usage_quality, billing_mode, input_tokens, output_tokens, total_tokens)
      values (gen_random_uuid(), now(), 'claude-max', 'agent-reply', 'ok', 'provider_reported', 'subscription', 0, 0, 0);
    raise exception 'claude-max 0/0/0 accepted';
  exception when check_violation then bad := bad + 1; end;
  assert bad = 4, format('expected 4 rejections, got %s', bad);
  -- accepted: real input/output with a null total; a lone input; an ambiguous zero with no numbers
  insert into public.execution_events (id, started_at, provider, purpose, outcome, usage_quality, billing_mode, input_tokens, output_tokens) values
    (gen_random_uuid(), now(), 'claude-max', 'agent-reply', 'ok', 'partial', 'subscription', 812, 96),
    (gen_random_uuid(), now(), 'claude-max', 'agent-reply', 'ok', 'partial', 'subscription', 812, null);
  insert into public.execution_events (id, started_at, provider, purpose, outcome, usage_quality, billing_mode)
    values (gen_random_uuid(), now(), 'claude-max', 'agent-reply', 'ok', 'ambiguous_proxy_zero', 'subscription');
  -- other providers are unaffected: an lm-studio zero is a value it reported
  insert into public.execution_events (id, started_at, provider, purpose, outcome, usage_quality, billing_mode, input_tokens, output_tokens, total_tokens)
    values (gen_random_uuid(), now(), 'lm-studio', 'agent-reply', 'ok', 'provider_reported', 'local', 0, 0, 0);
  delete from public.execution_events;
end $$;

-- @test correlation ids must be UUIDs and typed; nothing is stored as an opaque string
do $$
declare bad int := 0;
begin
  begin
    insert into public.execution_events (id, started_at, provider, purpose, outcome, usage_quality, billing_mode, correlation_type, correlation_id)
      values (gen_random_uuid(), now(), 'gemini', 'chat-stream', 'ok', 'not_reported', 'unknown', 'chat_message', 'not-a-uuid');
    raise exception 'non-uuid correlation accepted';
  exception when check_violation then bad := bad + 1; end;
  begin
    insert into public.execution_events (id, started_at, provider, purpose, outcome, usage_quality, billing_mode, correlation_type, correlation_id)
      values (gen_random_uuid(), now(), 'gemini', 'chat-stream', 'ok', 'not_reported', 'unknown', 'job', '');
    raise exception 'empty correlation id accepted';
  exception when check_violation then bad := bad + 1; end;
  begin
    insert into public.execution_events (id, started_at, provider, purpose, outcome, usage_quality, billing_mode, correlation_id)
      values (gen_random_uuid(), now(), 'gemini', 'chat-stream', 'ok', 'not_reported', 'unknown', '5d6f3c0e-1c1e-4b1e-9d3a-0a1b2c3d4e5f');
    raise exception 'id without a type accepted';
  exception when check_violation then bad := bad + 1; end;
  assert bad = 3, format('expected 3 rejections, got %s', bad);
  insert into public.execution_events (id, started_at, provider, purpose, outcome, usage_quality, billing_mode, correlation_type, correlation_id) values
    (gen_random_uuid(), now(), 'gemini', 'chat-stream', 'ok', 'not_reported', 'unknown', 'lead', '5D6F3C0E-1C1E-4B1E-9D3A-0A1B2C3D4E5F'),
    (gen_random_uuid(), now(), 'gemini', 'chat-stream', 'ok', 'not_reported', 'unknown', null, null);
  delete from public.execution_events;
end $$;

-- @test shadow cost is priced as of the event: adding a later price never restates history
do $$
declare cost numeric;
begin
  insert into public.execution_events (id, started_at, provider, model_requested, purpose, outcome, usage_quality, billing_mode, input_tokens, output_tokens) values
    ('00000000-0000-0000-0000-000000000f01', '2026-10-15T12:00:00Z',      'claude-max', 'claude-opus-4-6', 'agent-reply', 'ok', 'partial', 'subscription', 1000000, 1000000),
    ('00000000-0000-0000-0000-000000000f02', '2026-11-30T23:59:59Z',      'claude-max', 'claude-opus-4-6', 'agent-reply', 'ok', 'partial', 'subscription', 1000000, 1000000),
    ('00000000-0000-0000-0000-000000000f03', '2026-12-01T00:00:00Z',      'claude-max', 'claude-opus-4-6', 'agent-reply', 'ok', 'partial', 'subscription', 1000000, 1000000),
    ('00000000-0000-0000-0000-000000000f04', '2026-09-29T23:00:00Z',      'claude-max', 'claude-opus-4-6', 'agent-reply', 'ok', 'partial', 'subscription', 1000000, 1000000),
    ('00000000-0000-0000-0000-000000000f05', '2026-12-01T01:00:00+05:00', 'claude-max', 'claude-opus-4-6', 'agent-reply', 'ok', 'partial', 'subscription', 1000000, 1000000);
  -- before any newer price exists, the only row (verified 2026-09-30) applies from that date
  assert (select shadow_cost_usd from public.execution_events_with_shadow_cost where id = '00000000-0000-0000-0000-000000000f01') = 30.0;
  -- an event that predates every verified price is UNKNOWN, not priced at the earliest row and not zero
  assert (select shadow_cost_usd from public.execution_events_with_shadow_cost where id = '00000000-0000-0000-0000-000000000f04') is null, 'pre-price event must be unknown';
  -- a later price arrives
  insert into public.model_pricing (provider, model, input_usd_per_mtok, output_usd_per_mtok, source_url, retrieved_on)
    values ('anthropic', 'claude-opus-4-6', 10, 50, 'https://example.com/newer', date '2026-12-01');
  assert (select shadow_cost_usd from public.execution_events_with_shadow_cost where id = '00000000-0000-0000-0000-000000000f01') = 30.0, 'history was restated';
  assert (select shadow_cost_usd from public.execution_events_with_shadow_cost where id = '00000000-0000-0000-0000-000000000f02') = 30.0, 'last second before the new price was restated';
  assert (select shadow_cost_usd from public.execution_events_with_shadow_cost where id = '00000000-0000-0000-0000-000000000f03') = 60.0, 'new price not applied from its date';
  -- the event date is the UTC date: 01:00+05:00 on 12-01 is 20:00Z on 11-30, so it still uses the old price
  assert (select shadow_cost_usd from public.execution_events_with_shadow_cost where id = '00000000-0000-0000-0000-000000000f05') = 30.0, 'UTC date not used';
  assert (select shadow_pricing_retrieved_on from public.execution_events_with_shadow_cost where id = '00000000-0000-0000-0000-000000000f03') = date '2026-12-01';
  delete from public.execution_events;
  delete from public.model_pricing where source_url = 'https://example.com/newer';
end $$;

-- @test price selection: effective_from beats retrieved_on, and ties are broken deterministically
do $$
declare bad int := 0;
begin
  -- a price known to have taken effect BEFORE we verified it applies from its effective date
  insert into public.model_pricing (provider, model, input_usd_per_mtok, output_usd_per_mtok, source_url, retrieved_on, effective_from)
    values ('anthropic', 'claude-opus-4-6', 20, 100, 'https://example.com/eff', date '2027-01-10', date '2027-01-01');
  insert into public.execution_events (id, started_at, provider, model_requested, purpose, outcome, usage_quality, billing_mode, input_tokens, output_tokens) values
    ('00000000-0000-0000-0000-000000000a01', '2027-01-05T00:00:00Z', 'claude-max', 'claude-opus-4-6', 'agent-reply', 'ok', 'partial', 'subscription', 1000000, 1000000);
  assert (select shadow_cost_usd from public.execution_events_with_shadow_cost where id = '00000000-0000-0000-0000-000000000a01') = 120.0, 'effective_from not honoured';
  -- two rows, same effective date, different retrieval dates: the later verification wins
  insert into public.model_pricing (provider, model, input_usd_per_mtok, output_usd_per_mtok, source_url, retrieved_on, effective_from) values
    ('anthropic', 'claude-opus-4-6', 1, 1, 'https://example.com/t1', date '2027-02-02', date '2027-02-01'),
    ('anthropic', 'claude-opus-4-6', 2, 2, 'https://example.com/t2', date '2027-02-05', date '2027-02-01');
  insert into public.execution_events (id, started_at, provider, model_requested, purpose, outcome, usage_quality, billing_mode, input_tokens, output_tokens)
    values ('00000000-0000-0000-0000-000000000a02', '2027-03-01T00:00:00Z', 'claude-max', 'claude-opus-4-6', 'agent-reply', 'ok', 'partial', 'subscription', 1000000, 1000000);
  assert (select shadow_cost_usd from public.execution_events_with_shadow_cost where id = '00000000-0000-0000-0000-000000000a02') = 4.0, 'tie-break must pick the later retrieved_on';
  assert (select shadow_pricing_source_url from public.execution_events_with_shadow_cost where id = '00000000-0000-0000-0000-000000000a02') = 'https://example.com/t2';
  -- a second row for the same model and retrieval date is refused, so the ordering is total
  begin
    insert into public.model_pricing (provider, model, input_usd_per_mtok, output_usd_per_mtok, source_url, retrieved_on, effective_from)
      values ('anthropic', 'claude-opus-4-6', 3, 3, 'https://example.com/dup', date '2027-02-05', date '2027-02-01');
    raise exception 'duplicate (provider, model, retrieved_on) accepted';
  exception when unique_violation then bad := bad + 1; end;
  assert bad = 1;
  delete from public.execution_events;
  delete from public.model_pricing where source_url like 'https://example.com/%';
  assert (select count(*) from public.model_pricing) = 3, 'seed prices disturbed';
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

-- @test an all-zero Claude Max shape can never be labelled reported or partial, and real partial usage still works
do $$
declare bad int := 0; v record;
begin
  begin  -- 0/0/0 labelled provider_reported (the direct-insert / backfill case)
    insert into public.execution_events (id, started_at, provider, model_requested, purpose, outcome, usage_quality, billing_mode, input_tokens, output_tokens, total_tokens)
      values (gen_random_uuid(), '2026-10-15T12:00:00Z', 'claude-max', 'claude-opus-4-6', 'agent-reply', 'ok', 'provider_reported', 'subscription', 0, 0, 0);
    raise exception 'claude-max 0/0/0 provider_reported accepted';
  exception when check_violation then bad := bad + 1; end;
  begin  -- 0/0 with a null total labelled partial
    insert into public.execution_events (id, started_at, provider, model_requested, purpose, outcome, usage_quality, billing_mode, input_tokens, output_tokens)
      values (gen_random_uuid(), '2026-10-15T12:00:00Z', 'claude-max', 'claude-opus-4-6', 'agent-reply', 'ok', 'partial', 'subscription', 0, 0);
    raise exception 'claude-max 0/0 partial accepted';
  exception when check_violation then bad := bad + 1; end;
  begin  -- a lone zero labelled partial
    insert into public.execution_events (id, started_at, provider, model_requested, purpose, outcome, usage_quality, billing_mode, input_tokens)
      values (gen_random_uuid(), '2026-10-15T12:00:00Z', 'claude-max', 'claude-opus-4-6', 'agent-reply', 'ok', 'partial', 'subscription', 0);
    raise exception 'claude-max lone zero partial accepted';
  exception when check_violation then bad := bad + 1; end;
  begin  -- non-zero counts still cannot be "provider_reported" for Claude Max
    insert into public.execution_events (id, started_at, provider, model_requested, purpose, outcome, usage_quality, billing_mode, input_tokens, output_tokens, total_tokens)
      values (gen_random_uuid(), '2026-10-15T12:00:00Z', 'claude-max', 'claude-opus-4-6', 'agent-reply', 'ok', 'provider_reported', 'subscription', 10, 5, 15);
    raise exception 'claude-max provider_reported accepted';
  exception when check_violation then bad := bad + 1; end;
  assert bad = 4, format('expected 4 rejections, got %s', bad);
  assert (select count(*) from public.execution_events) = 0, 'a rejected row was stored';
  -- valid non-zero partial usage still succeeds and is priced; zero never becomes a $0 cost
  insert into public.execution_events (id, started_at, provider, model_requested, purpose, outcome, usage_quality, billing_mode, input_tokens, output_tokens) values
    ('00000000-0000-0000-0000-0000000000b1', '2026-10-15T12:00:00Z', 'claude-max', 'claude-opus-4-6', 'agent-reply', 'ok', 'partial', 'subscription', 1000000, 1000000),
    ('00000000-0000-0000-0000-0000000000b2', '2026-10-15T12:00:00Z', 'claude-max', 'claude-opus-4-6', 'agent-reply', 'ok', 'partial', 'subscription', 7, null);
  select * into v from public.execution_events_with_shadow_cost where id = '00000000-0000-0000-0000-0000000000b1';
  assert v.shadow_cost_usd = 30.0 and v.total_tokens is null;
  assert (select shadow_cost_usd from public.execution_events_with_shadow_cost where id = '00000000-0000-0000-0000-0000000000b2') is null, 'incomplete usage must not be priced';
  delete from public.execution_events;
end $$;
