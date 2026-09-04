CREATE INDEX "estates_centroid_gist_idx" ON "estates" USING gist ("centroid");--> statement-breakpoint
CREATE INDEX "estates_boundary_gist_idx" ON "estates" USING gist ("boundary");--> statement-breakpoint
CREATE INDEX "plots_filter_idx" ON "plots" USING btree ("estate_id","status","area_cents");--> statement-breakpoint
CREATE INDEX "plots_geom_gist_idx" ON "plots" USING gist ("geom");