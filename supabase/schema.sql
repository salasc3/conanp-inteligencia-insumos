create table if not exists summary_by_anp (
  anp_code text primary key,
  anp_name text,
  source_records integer,
  deduped_occurrences integer,
  possible_duplicate_records integer,
  unique_taxa integer,
  records_with_coordinates integer,
  records_with_quality_flags integer
);

create table if not exists summary_by_source (
  id bigint generated always as identity primary key,
  anp_code text,
  anp_name text,
  source_system text,
  source_file text,
  source_records integer,
  deduped_occurrences integer,
  unique_taxa integer,
  records_with_coordinates integer,
  records_with_quality_flags integer
);

create table if not exists data_quality_summary (
  quality_flag text primary key,
  affected_records integer,
  affected_anps text
);

create table if not exists source_inventory (
  id bigint generated always as identity primary key,
  path text,
  file_name text,
  anp_code text,
  anp_name text,
  file_type text,
  size_bytes bigint,
  role text
);

create table if not exists species_index (
  species_uid text primary key,
  anp_code text,
  anp_name text,
  accepted_name_norm text,
  accepted_scientific_name text,
  taxon_rank text,
  kingdom text,
  phylum text,
  class_name text,
  order_name text,
  family text,
  genus text,
  source_systems text,
  authority_ids text,
  source_record_count integer,
  deduped_occurrence_count integer,
  source_files text,
  nom059 text,
  iucn text,
  cites text,
  priority_species text,
  endemicity text,
  invasive_exotic text,
  quality_flags text,
  taxonomic_resolution_status text,
  traceability_status text
);

create table if not exists normalized_occurrences (
  occurrence_uid text primary key,
  anp_code text,
  anp_name text,
  source_system text,
  source_record_id text,
  source_occurrence_id text,
  source_file text,
  source_row_number integer,
  scientific_name_raw text,
  accepted_scientific_name text,
  accepted_name_norm text,
  taxon_rank text,
  authority_system text,
  authority_taxon_id text,
  kingdom text,
  phylum text,
  class_name text,
  order_name text,
  family text,
  genus text,
  latitude double precision,
  longitude double precision,
  coordinate_uncertainty_m double precision,
  event_date text,
  event_year text,
  locality text,
  municipality text,
  state_province text,
  country text,
  basis_of_record text,
  institution text,
  collection text,
  catalog_number text,
  recorded_by text,
  identified_by text,
  license text,
  source_url text,
  source_citation text,
  nom059 text,
  iucn text,
  cites text,
  priority_species text,
  endemicity text,
  invasive_exotic text,
  raw_trace jsonb,
  has_coordinates boolean,
  coordinate_invalid boolean,
  country_review_flag boolean,
  high_uncertainty_flag boolean,
  taxon_missing_flag boolean,
  occurrence_fingerprint text,
  source_exact_duplicate boolean,
  duplicate_group_size integer,
  dedupe_rank integer,
  is_representative_record boolean,
  quality_flags text
);

create table if not exists publication_ingestion_leads (
  id bigint generated always as identity primary key,
  anp_code text,
  anp_name text,
  lead_type text,
  title text,
  use_in_pilot text,
  url text,
  screening_status text
);

create index if not exists idx_species_anp_name on species_index (anp_code, accepted_name_norm);
create index if not exists idx_species_sources on species_index (source_systems);
create index if not exists idx_occurrences_anp_taxon on normalized_occurrences (anp_code, accepted_name_norm);
create index if not exists idx_occurrences_quality on normalized_occurrences (quality_flags);
create index if not exists idx_source_summary_anp on summary_by_source (anp_code, source_system);
