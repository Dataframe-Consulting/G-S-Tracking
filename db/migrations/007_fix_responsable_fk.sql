-- Migration 007: corregir FK de responsable_id para apuntar a user_profiles(user_id)

alter table viajes drop constraint if exists viajes_responsable_id_fkey;

-- Limpiar valores huérfanos (IDs que no existen en user_profiles.user_id)
update viajes
set responsable_id = null
where responsable_id is not null
  and responsable_id not in (select user_id from user_profiles);

alter table viajes
  add constraint viajes_responsable_id_fkey
  foreign key (responsable_id) references user_profiles(user_id) on delete set null;
