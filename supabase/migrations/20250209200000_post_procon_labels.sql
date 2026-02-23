-- 찬반 글에 사용자 지정 옵션 라벨 저장 (기본 찬/반)
alter table public.post_procon
  add column if not exists pro_label text not null default '찬',
  add column if not exists con_label text not null default '반';

comment on column public.post_procon.pro_label is '찬성 옵션 라벨 (사용자 입력 또는 기본 찬)';
comment on column public.post_procon.con_label is '반대 옵션 라벨 (사용자 입력 또는 기본 반)';
