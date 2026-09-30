-- Read-only. Run in Supabase SQL Editor before deploying. Do NOT run catalog seeds.
select id,price,published,file_path,
 exists(select 1 from storage.objects o where o.bucket_id='akram-books' and o.name=b.file_path) as private_pdf_exists
from public.akram_books b where price>0 order by id;
select id,public from storage.buckets where id in('akram-books','akram-covers');
select exists(select 1 from public.akram_admins) as owner_configured;
select to_regclass('public.akram_orders') as manual_orders,
 to_regclass('public.akram_payment_orders') as provider_orders,
 to_regclass('public.akram_reviews') as reviews;
-- Every paid title must have private_pdf_exists=true. akram-books.public must be false.
