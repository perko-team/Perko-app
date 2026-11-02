-- Supabase security advisor (function_search_path_mutable): the two small helpers from the staff PIN
-- migration get a fixed search_path like every other function here. Neither reads a table; this only pins
-- name resolution so a role's search_path can never change what they call.
alter function public.pin_max_failures() set search_path = public;
alter function public.israel_day_end(timestamptz) set search_path = public;
