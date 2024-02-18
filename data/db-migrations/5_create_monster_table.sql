create table monsters (
    id        integer primary key not null,
    save_id   integer not null,
    tile_id  integer not null,

    foreign key(save_id) references saves(id),
    foreign key(tile_id) references map_tiles(id)
);
