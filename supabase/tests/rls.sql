-- RLS sınama: iki sahte kullanıcı. Sonunda bilerek hata verilip her şey geri alınır.
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  n int;
  r text := '';
begin
  insert into auth.users (id, aud, role, email) values
    (a, 'authenticated', 'authenticated', 'a@test.invalid'),
    (b, 'authenticated', 'authenticated', 'b@test.invalid');

  -- Kullanıcı A
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.projects (id, name, data) values ('p1', 'A projesi', '{"x":1}'::jsonb);
  insert into public.folders (id, name) values ('f1', 'A klasoru');
  insert into public.assets (id, name, kind) values ('a1', 'logo.png', 'image');
  insert into public.api_tokens (name, token_hash) values ('cc', 'hash-a');
  select count(*) into n from public.projects; r := r || 'A kendi projelerini goruyor: ' || n || ' (beklenen 1)' || E'\n';

  begin
    insert into public.projects (user_id, id, name, data) values (b, 'px', 'x', '{}'::jsonb);
    r := r || 'HATA: A, B adina proje ekleyebildi' || E'\n';
  exception when others then
    r := r || 'A -> B adina proje eklemek engellendi: OK' || E'\n';
  end;

  begin
    insert into storage.objects (bucket_id, name, owner) values ('assets', a::text || '/dosya1', a);
    r := r || 'A kendi klasorune dosya yukledi: OK' || E'\n';
  exception when others then
    r := r || 'HATA: A kendi klasorune yukleyemedi: ' || sqlerrm || E'\n';
  end;
  begin
    insert into storage.objects (bucket_id, name, owner) values ('assets', b::text || '/dosya2', a);
    r := r || 'HATA: A, B klasorune dosya yukleyebildi' || E'\n';
  exception when others then
    r := r || 'A -> B klasorune dosya yuklemek engellendi: OK' || E'\n';
  end;

  -- Kullanıcı B
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.projects; r := r || 'B, A''nin projelerini goruyor: ' || n || ' (beklenen 0)' || E'\n';
  select count(*) into n from public.folders;  r := r || 'B, A''nin klasorlerini goruyor: ' || n || ' (beklenen 0)' || E'\n';
  select count(*) into n from public.assets;   r := r || 'B, A''nin dosya kayitlarini goruyor: ' || n || ' (beklenen 0)' || E'\n';
  select count(*) into n from public.api_tokens; r := r || 'B, A''nin anahtarlarini goruyor: ' || n || ' (beklenen 0)' || E'\n';
  select count(*) into n from storage.objects where bucket_id = 'assets'; r := r || 'B, A''nin dosyalarini goruyor: ' || n || ' (beklenen 0)' || E'\n';
  update public.projects set name = 'ele gecirildi' where id = 'p1'; get diagnostics n = row_count; r := r || 'B, A''nin projesini degistirdi: ' || n || ' satir (beklenen 0)' || E'\n';
  delete from public.projects where id = 'p1'; get diagnostics n = row_count; r := r || 'B, A''nin projesini sildi: ' || n || ' satir (beklenen 0)' || E'\n';

  -- Girişsiz ziyaretçi
  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin
    select count(*) into n from public.projects; r := r || 'Girissiz ziyaretci projeleri goruyor: ' || n || ' (beklenen 0)' || E'\n';
  exception when others then
    r := r || 'Girissiz ziyaretci: erisim reddedildi: OK' || E'\n';
  end;

  reset role;
  raise exception E'SONUC\n%', r;
end $$;
