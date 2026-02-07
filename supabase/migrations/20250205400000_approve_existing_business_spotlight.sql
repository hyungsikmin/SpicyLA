-- 기존에 등록된 비즈니스는 승인된 것으로 간주 (노출 유지)
update public.business_spotlight
set approved = true
where approved is distinct from true;
