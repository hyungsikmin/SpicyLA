-- Add reaction_type to post_reactions (laugh, angry, mindblown, eyes, chili)
alter table public.post_reactions
  add column if not exists reaction_type text not null default 'chili';

-- Allow one reaction per type per user per post
alter table public.post_reactions
  drop constraint if exists post_reactions_post_id_user_id_key;

create unique index if not exists post_reactions_post_user_type_key
  on public.post_reactions (post_id, user_id, reaction_type);

comment on column public.post_reactions.reaction_type is 'One of: laugh, angry, mindblown, eyes, chili';
