-- Flashcard Hero — Phase 7: deck & folder configuration
--
-- Adds color, icon (emoji) to folders; and color, icon, front_label,
-- back_label, study_order to decks.
--
-- Safe to run on an existing database: only adds columns with defaults.
-- Run once in the Supabase SQL editor.

alter table public.folders
  add column if not exists color      text,
  add column if not exists icon       text;

alter table public.decks
  add column if not exists color       text,
  add column if not exists icon        text,
  add column if not exists front_label text not null default 'Front',
  add column if not exists back_label  text not null default 'Back',
  add column if not exists study_order text not null default 'sequential';
