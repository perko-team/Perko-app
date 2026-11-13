-- Focus group #6: business info a customer needs before walking in. Opening hours per weekday (Friday
-- included), a phone number, and an optional kashrut line, all set by the owner in the dashboard. The old free
-- text `hours` stays as a fallback for businesses that have not filled the week yet.

-- Seven entries, Sunday first: null (closed) or {"open": "HH:MM", "close": "HH:MM"}. Same rules as
-- parseWeeklyHours() in supabase/functions/_shared/hours.ts.
create function public.valid_weekly_hours(p jsonb) returns boolean
language sql immutable set search_path = public as $$
  select p is null or (
    jsonb_typeof(p) = 'array' and jsonb_array_length(p) = 7 and not exists (
      select 1 from jsonb_array_elements(p) d
      where not (
        jsonb_typeof(d) = 'null' or (
          jsonb_typeof(d) = 'object'
          and coalesce(d->>'open', '') ~ '^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$'
          and coalesce(d->>'close', '') ~ '^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$'
        )
      )
    )
  )
$$;

alter table public.businesses
  add column weekly_hours jsonb check (public.valid_weekly_hours(weekly_hours)),
  add column phone text check (phone is null or phone ~ '^[0-9+() -]{9,20}$'),
  add column kashrut text check (kashrut is null or char_length(kashrut) between 1 and 80);

-- Owners edit these on their own business (the update policy from 20261102100000 already limits the rows).
grant update (weekly_hours, phone, kashrut) on public.businesses to authenticated;

-- The sample businesses move from the free text to the week (same hours, Friday included).
update public.businesses set weekly_hours = case slug
  when 'cafe-pina' then '[{"open":"07:00","close":"19:00"},{"open":"07:00","close":"19:00"},{"open":"07:00","close":"19:00"},{"open":"07:00","close":"19:00"},{"open":"07:00","close":"19:00"},{"open":"07:00","close":"14:00"},null]'::jsonb
  when 'zaatar' then '[{"open":"12:00","close":"23:00"},{"open":"12:00","close":"23:00"},{"open":"12:00","close":"23:00"},{"open":"12:00","close":"23:00"},{"open":"12:00","close":"23:00"},null,null]'::jsonb
  when 'dafdouf' then '[{"open":"10:00","close":"20:00"},{"open":"10:00","close":"20:00"},{"open":"10:00","close":"20:00"},{"open":"10:00","close":"20:00"},{"open":"10:00","close":"20:00"},{"open":"09:00","close":"14:00"},null]'::jsonb
  when 'hagefen-bakery' then '[{"open":"06:30","close":"15:00"},{"open":"06:30","close":"15:00"},{"open":"06:30","close":"15:00"},{"open":"06:30","close":"15:00"},{"open":"06:30","close":"15:00"},{"open":"06:30","close":"15:00"},null]'::jsonb
  when 'pirhei-hasdera' then '[{"open":"09:00","close":"19:00"},{"open":"09:00","close":"19:00"},{"open":"09:00","close":"19:00"},{"open":"09:00","close":"19:00"},{"open":"09:00","close":"19:00"},{"open":"08:00","close":"14:00"},null]'::jsonb
end
where is_sample and slug in ('cafe-pina', 'zaatar', 'dafdouf', 'hagefen-bakery', 'pirhei-hasdera');
