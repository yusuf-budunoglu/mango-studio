-- Güvenlik sıkılaştırması (7 Ekim 2026 denetimi). Tek seferde çalışır; bir yerde hata olursa hiçbir şey değişmez.
--
-- * Depolama kotası artık dosyaların GERÇEK boyutuna bakar. Eskiden yalnızca `assets.size` (üyenin kendi
--   bildirdiği sayı) sayılıyordu: 1 bayt bildirip 50 MB yüklemek, satırı silip dosyayı bırakmak ya da var olan
--   dosyanın üstüne daha büyüğünü yazmak kotayı atlatıyordu. Şimdi kullanım = her dosya için bildirilen ile
--   gerçek boyuttan büyük olanı + satırı olmayan dosyalar; kota dolmuşsa Storage yeni dosyayı da, üstüne yazmayı
--   da reddeder. Dosya yolu tam olarak `<üye>/<dosya id>` olmalı (alt klasörle aynı satıra çok dosya yüklenemez).
-- * Üye başına sınırlar (veritabanını doldurup siteyi herkes için kilitlemeye karşı): 500 proje, toplam 200 MB
--   proje verisi, 300 000 karakterlik küçük resim, 200 klasör, 5000 dosya kaydı, günde 500 çıktı kaydı.
-- * `storage_used` / `storage_quota` başkasının kimliğiyle çağrılamaz (plan ve kullanım sızıyordu); tetikleyici
--   işlevleri ve yalnızca üyeye gereken işlevler girişsiz ziyaretçiye kapatıldı.
-- * Tablo yetkileri: girişsiz ziyaretçi yalnızca genel şablonları okur; kimsede TRUNCATE yok.

begin;

-- Depolama: gerçek boyut -----------------------------------------------------------------------------------

create or replace function public.storage_used(uid uuid) returns bigint
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(greatest(coalesce(a.size, 0), coalesce(o.size, 0))), 0)::bigint
  from (select id, size from public.assets where user_id = uid) a
  full join (
    -- yol `<üye id (36 karakter)>/<dosya id>`: 38. karakterden sonrası dosya id'si.
    -- Aynı yolda birden çok satır (dosya sürümleri) olabilir: hepsi yer tutar, toplanır.
    select substr(ob.name, 38) as id, sum(coalesce((ob.metadata ->> 'size')::bigint, 0)) as size
    from storage.objects ob
    where ob.bucket_id = 'assets' and ob.name like uid::text || '/%'
    group by 1
  ) o on o.id = a.id;
$$;

-- Storage kuralları için: oturum sahibinin kotasında yer var mı (kullanım kotayı aşmamış mı).
create function public.storage_has_room() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.storage_used(auth.uid()) <= public.storage_quota(auth.uid());
$$;

drop policy "assets dosyaları: yükle" on storage.objects;
drop policy "assets dosyaları: güncelle" on storage.objects;

create policy "assets dosyaları: yükle" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'assets'
    and exists (select 1 from public.assets a where a.user_id = (select auth.uid()) and objects.name = a.user_id::text || '/' || a.id)
    and (select public.storage_has_room())
  );

create policy "assets dosyaları: güncelle" on storage.objects
  for update to authenticated
  using (bucket_id = 'assets' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (
    bucket_id = 'assets'
    and exists (select 1 from public.assets a where a.user_id = (select auth.uid()) and objects.name = a.user_id::text || '/' || a.id)
    and (select public.storage_has_room())
  );

-- Üye başına sınırlar ----------------------------------------------------------------------------------------

alter table public.projects
  add constraint projects_thumbnail_size check (thumbnail is null or char_length(thumbnail) <= 300000);

-- Kaydetme upsert ile gelir (var olan satırda da INSERT tetikleyicisi çalışır): bu yüzden hep "diğer" satırlar sayılır.
create function public.enforce_project_limits() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  others bigint;
  bytes bigint;
begin
  select count(*), coalesce(sum(pg_column_size(p.data)), 0) into others, bytes
  from public.projects p where p.user_id = new.user_id and p.id <> new.id;
  if others >= 500 then raise exception 'project_limit_reached' using errcode = 'P0001'; end if;
  if bytes + pg_column_size(new.data) > 209715200 then raise exception 'project_data_limit_reached' using errcode = 'P0001'; end if;
  return new;
end;
$$;

create trigger projects_limits
  before insert or update of data on public.projects
  for each row execute function public.enforce_project_limits();

create function public.enforce_folder_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.folders f where f.user_id = new.user_id and f.id <> new.id) >= 200 then
    raise exception 'folder_limit_reached' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger folders_limit
  before insert on public.folders
  for each row execute function public.enforce_folder_limit();

create function public.enforce_asset_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.assets a where a.user_id = new.user_id and a.id <> new.id) >= 5000 then
    raise exception 'asset_limit_reached' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger assets_limit
  before insert on public.assets
  for each row execute function public.enforce_asset_limit();

create function public.enforce_export_rate() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.export_events e where e.user_id = new.user_id and e.created_at > now() - interval '1 day') >= 500 then
    raise exception 'export_log_limit_reached' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger export_events_rate
  before insert on public.export_events
  for each row execute function public.enforce_export_rate();

-- İşlev yetkileri ----------------------------------------------------------------------------------------------

-- Başkasının kimliğiyle çağrılabiliyordu; yalnızca sunucudaki diğer işlevler kullanır.
revoke execute on function public.storage_used(uuid) from public, anon, authenticated;
revoke execute on function public.storage_quota(uuid) from public, anon, authenticated;

-- Tetikleyici işlevleri: doğrudan çağrılmaz.
revoke execute on function public.create_profile() from public, anon, authenticated;
revoke execute on function public.enforce_storage_quota() from public, anon, authenticated;
revoke execute on function public.set_project_asset_ids() from public, anon, authenticated;
revoke execute on function public.enforce_project_limits() from public, anon, authenticated;
revoke execute on function public.enforce_folder_limit() from public, anon, authenticated;
revoke execute on function public.enforce_asset_limit() from public, anon, authenticated;
revoke execute on function public.enforce_export_rate() from public, anon, authenticated;

-- Yalnızca giriş yapmış üyeye gerekenler.
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.storage_status() from public, anon;
revoke execute on function public.storage_has_room() from public, anon;
revoke execute on function public.project_asset_ids(jsonb) from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.storage_status() to authenticated;
grant execute on function public.storage_has_room() to authenticated;
grant execute on function public.project_asset_ids(jsonb) to authenticated;

-- Tablo yetkileri ----------------------------------------------------------------------------------------------
-- Erişimi asıl RLS sınırlar; bu, ikinci kat.

revoke all on table public.projects, public.folders, public.assets, public.api_tokens, public.profiles, public.export_events from anon;
revoke insert, update, delete, truncate, references, trigger on table public.public_templates from anon;
revoke truncate, references, trigger on table
  public.projects, public.folders, public.assets, public.api_tokens, public.profiles, public.export_events, public.public_templates
  from authenticated;
revoke insert, update, delete on table public.profiles from authenticated;

commit;
