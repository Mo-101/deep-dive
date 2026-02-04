-- Enable realtime for hotspots and alerts tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.hotspots;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cyclone_tracks;