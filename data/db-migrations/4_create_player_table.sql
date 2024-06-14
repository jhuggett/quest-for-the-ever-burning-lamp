create table players (
    id        integer primary key not null,
    view_radius integer not null,
    save_id   integer not null,
    tile_id  integer not null,

    foreign key(save_id) references saves(id) on delete cascade,
    foreign key(tile_id) references map_tiles(id) 
);
