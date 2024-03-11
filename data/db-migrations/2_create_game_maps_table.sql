create table game_maps (
    id        integer primary key not null,
    level    integer not null,
    save_id   integer not null,
    foreign key(save_id) references saves(id)
);
