create table exits (
    id        integer primary key not null,
    from_map_id integer not null,
    to_map_id integer not null,
    from_map_tile_id integer not null,
    to_map_tile_id integer,

    foreign key(from_map_id) references game_maps(id),
    foreign key(to_map_id) references game_maps(id),
    foreign key(from_map_tile_id) references map_tiles(id),
    foreign key(to_map_tile_id) references map_tiles(id)
);

