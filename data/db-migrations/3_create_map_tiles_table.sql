create table map_tiles (
    id        integer primary key not null,
    x         integer not null,
    y         integer not null,
    is_wall  boolean not null,
    game_map_id    integer not null,
    foreign key(game_map_id) references game_maps(id) on delete cascade
);
