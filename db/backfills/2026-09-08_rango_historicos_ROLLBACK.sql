-- ROLLBACK del backfill del 2026-09-08 (rango de viajes historicos).
-- Restaura fecha_inicio/fecha_fin capturadas a mano en los 38 viajes corregidos.
-- Correr COMPLETO si hay que revertir. No toca fechas_automaticas (siguen en false).

update viajes set fecha_inicio='2026-09-11', fecha_fin='2026-09-11' where id='ff103b48-ae8b-47e4-9bc1-6a28cbabf1a2'; -- #318
update viajes set fecha_inicio='2026-09-06', fecha_fin='2026-09-10' where id='74f1d7d6-626e-42cc-bad2-9048731f1797'; -- #311
update viajes set fecha_inicio='2026-09-07', fecha_fin='2026-09-09' where id='6e4fd286-9a79-4881-998e-9d17c29b68b1'; -- #289
update viajes set fecha_inicio='2026-09-01', fecha_fin='2026-09-01' where id='defa2548-5e83-4e96-987f-23ec26331e58'; -- #286
update viajes set fecha_inicio='2026-09-04', fecha_fin='2026-09-06' where id='746e9d2f-a514-439e-bd6f-57a174f981d2'; -- #274
update viajes set fecha_inicio='2026-08-31', fecha_fin='2026-08-03' where id='d6055967-f0ce-4238-a2b3-2dbeb1f9a238'; -- #272
update viajes set fecha_inicio='2026-08-30', fecha_fin='2026-09-01' where id='ae2efae0-2c14-4ad0-8a14-0e0c29326256'; -- #270
update viajes set fecha_inicio='2026-09-02', fecha_fin='2026-09-04' where id='4e5da434-c3da-4867-aef6-8e638c42aae1'; -- #268
update viajes set fecha_inicio='2026-09-01', fecha_fin='2026-08-27' where id='a595fc3c-2f35-4703-97dc-a2186d8b89c9'; -- #257
update viajes set fecha_inicio='2026-08-28', fecha_fin='2026-09-02' where id='1a9f6bc8-efe7-45e4-bcaa-d6e92d71dde7'; -- #240
update viajes set fecha_inicio='2026-08-28', fecha_fin='2026-09-02' where id='ef56d4bf-c84a-4664-976d-53ca95babcb7'; -- #238
update viajes set fecha_inicio='2026-08-26', fecha_fin='2026-08-26' where id='5c2ec472-faa8-4387-a0e1-ac58a19a063f'; -- #227
update viajes set fecha_inicio='2026-08-22', fecha_fin='2026-08-24' where id='a529eccd-3d69-47fe-9c75-3da2d843ecc5'; -- #217
update viajes set fecha_inicio='2026-08-25', fecha_fin='2026-08-26' where id='cc198488-fee1-43a6-ab49-5daee32a1b96'; -- #215
update viajes set fecha_inicio='2026-08-22', fecha_fin='2026-08-24' where id='84780715-d781-4b88-bdb3-2dfb3bb7fda3'; -- #212
update viajes set fecha_inicio='2026-08-21', fecha_fin='2026-08-26' where id='36ad16d4-346a-46d9-98ca-c29e4687db07'; -- #195
update viajes set fecha_inicio='2026-08-21', fecha_fin='2026-08-26' where id='95b809cc-70b6-40c3-808f-4c8abd1e6e6d'; -- #193
update viajes set fecha_inicio='2026-08-14', fecha_fin='2026-08-18' where id='01997e12-6aa7-4a62-9c1b-9f747b1af2c0'; -- #188
update viajes set fecha_inicio='2026-08-25', fecha_fin='2026-08-28' where id='b96c5677-ec01-4f14-9386-156433f130a0'; -- #184
update viajes set fecha_inicio='2026-08-23', fecha_fin='2026-08-25' where id='1d185ddd-dc9d-4d3d-bda3-752a5c8c751c'; -- #177
update viajes set fecha_inicio='2026-08-14', fecha_fin='2026-08-16' where id='6d889571-a5ae-40e1-91be-2bf81b1d2ff3'; -- #173
update viajes set fecha_inicio='2026-08-16', fecha_fin='2026-08-17' where id='d079f07a-b600-41ef-a44d-837214e75592'; -- #141
update viajes set fecha_inicio='2026-08-09', fecha_fin='2026-08-11' where id='11987c3b-94cc-491b-8878-954c7c78efca'; -- #125
update viajes set fecha_inicio='2026-08-08', fecha_fin='2026-08-12' where id='54264742-348d-4c8c-a8e1-a1260192d70d'; -- #112
update viajes set fecha_inicio='2026-08-06', fecha_fin='2026-08-07' where id='b13c19b5-cf95-4991-b0e3-7e6be87fdfa2'; -- #108
update viajes set fecha_inicio='2026-08-05', fecha_fin='2026-08-09' where id='6ed067e4-5ae2-48df-9dba-841b6125564c'; -- #97
update viajes set fecha_inicio='2026-08-01', fecha_fin='2026-08-05' where id='a8351a8b-9799-45e5-82a5-6a7e7b941a0a'; -- #79
update viajes set fecha_inicio='2026-08-01', fecha_fin='2026-08-03' where id='2c87dedf-dd63-4bcc-bce2-8dfb49e604aa'; -- #78
update viajes set fecha_inicio='2026-07-31', fecha_fin='2026-07-31' where id='62b60221-f067-41b0-9e71-15dc85556699'; -- #70
update viajes set fecha_inicio='2026-07-30', fecha_fin='2026-07-31' where id='55856b8c-8248-43bc-a96f-6326cb10d034'; -- #69
update viajes set fecha_inicio='2026-07-29', fecha_fin='2026-07-30' where id='a9764148-e8c1-4d03-af79-da6eb8d61211'; -- #66
update viajes set fecha_inicio='2026-07-29', fecha_fin='2026-08-02' where id='e7f629bd-94a5-4447-bd9f-c95984771c76'; -- #64
update viajes set fecha_inicio='2026-07-27', fecha_fin='2026-07-31' where id='b93a4a0b-303a-4680-8f46-973009f6eada'; -- #54
update viajes set fecha_inicio='2026-07-25', fecha_fin='2026-07-28' where id='bf85afea-2596-4d80-885c-8c496ecfa81e'; -- #43
update viajes set fecha_inicio='2026-07-27', fecha_fin='2026-07-27' where id='46885c33-c6b8-4152-a493-7405958810ef'; -- #37
update viajes set fecha_inicio='2026-07-28', fecha_fin='2026-07-28' where id='34d42f23-549b-4457-9a4b-39b7acddfd40'; -- #34
update viajes set fecha_inicio='2026-07-24', fecha_fin='2026-07-29' where id='8c66fdae-59f2-4dfa-adc7-ea1fdf15c425'; -- #33
update viajes set fecha_inicio='2026-07-23', fecha_fin='2026-07-26' where id='395e0220-1367-4f16-9c81-8e0e21e441f3'; -- #31
