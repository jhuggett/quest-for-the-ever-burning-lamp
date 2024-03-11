create table items (
  id       integer primary key not null,
  item_type string not null,
  tile_id integer not null,

  foreign key(tile_id) references map_tiles(id)
)