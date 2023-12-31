import { within } from "@jhuggett/terminal/bounds/bounds";
import { Page } from "./page";
import { Save } from "../data/models/save";
import { gray, red, yellow } from "@jhuggett/terminal";
import { db } from "..";
import { MapTile } from "../data/models/map-tile";

export type GamePageProps = {
  save: Save;
};

export class GamePage extends Page<GamePageProps> {
  beforeSetup(): void {
    const view = this.root.createChildElement(() => within(this.root), {});

    view.renderer = ({ cursor }) => {
      cursor.fill(" ");

      const player = this.props.save.getPlayer(db);
      const playerTile = player.getTile(db);

      const tiles = player.visibleTiles(db);

      const centerOffset = {
        x: Math.floor(view.bounds.width / 4),
        y: Math.floor(view.bounds.height / 2),
      };

      const center = {
        x: playerTile.props.x - centerOffset.x,
        y: playerTile.props.y - centerOffset.y,
      };

      for (const tile of tiles) {
        const x = tile.props.x * 2 - center.x * 2;
        const y = tile.props.y - center.y;

        if (
          x >= 0 &&
          x < view.bounds.width &&
          y >= 0 &&
          y < view.bounds.height
        ) {
          const distanceToPlayer = Math.sqrt(
            Math.pow(playerTile.props.x - tile.props.x, 2) +
              Math.pow(playerTile.props.y - tile.props.y, 2) +
              1 // 1 being the height of the player
          );

          const tileBrightness = Math.min(
            player.props.view_radius / Math.pow(distanceToPlayer, 2),
            1
          );

          cursor.moveTo({ x, y });
          if (tile.props.is_wall) {
            cursor.write("  ", {
              backgroundColor: yellow(tileBrightness),
            });
          } else {
            cursor.write("  ", {
              backgroundColor: gray(tileBrightness),
            });
          }
        }
      }

      cursor.moveTo({
        x: centerOffset.x * 2,
        y: centerOffset.y,
      });

      cursor.write("  ", {
        backgroundColor: red(0.9),
      });
    };

    view.render();

    view.focus();

    view.on("Arrow Up", () => {
      const player = this.props.save.getPlayer(db);
      const playerTile = player.getTile(db);
      const tileAbove = MapTile.where(db, {
        game_map_id: playerTile.props.game_map_id,
        x: playerTile.props.x,
        y: playerTile.props.y - 1,
      })[0];

      if (tileAbove && !tileAbove.props.is_wall) {
        player.props.tile_id = tileAbove.props.id;

        player.props.view_radius = Math.max(0, player.props.view_radius - 0.1);

        player.save(db);
        view.render();
      }
    });

    view.on("Arrow Down", () => {
      const player = this.props.save.getPlayer(db);
      const playerTile = player.getTile(db);
      const tileBelow = MapTile.where(db, {
        game_map_id: playerTile.props.game_map_id,
        x: playerTile.props.x,
        y: playerTile.props.y + 1,
      })[0];

      if (tileBelow && !tileBelow.props.is_wall) {
        player.props.tile_id = tileBelow.props.id;

        player.props.view_radius = Math.max(0, player.props.view_radius - 0.1);

        player.save(db);
        view.render();
      }
    });

    view.on("Arrow Left", () => {
      const player = this.props.save.getPlayer(db);
      const playerTile = player.getTile(db);
      const tileLeft = MapTile.where(db, {
        game_map_id: playerTile.props.game_map_id,
        x: playerTile.props.x - 1,
        y: playerTile.props.y,
      })[0];

      if (tileLeft && !tileLeft.props.is_wall) {
        player.props.tile_id = tileLeft.props.id;

        player.props.view_radius = Math.max(0, player.props.view_radius - 0.1);

        player.save(db);
        view.render();
      }
    });

    view.on("Arrow Right", () => {
      const player = this.props.save.getPlayer(db);
      const playerTile = player.getTile(db);
      const tileRight = MapTile.where(db, {
        game_map_id: playerTile.props.game_map_id,
        x: playerTile.props.x + 1,
        y: playerTile.props.y,
      })[0];

      if (tileRight && !tileRight.props.is_wall) {
        player.props.tile_id = tileRight.props.id;

        player.props.view_radius = Math.max(0, player.props.view_radius - 0.1);

        player.save(db);
        view.render();
      }
    });

    this.root.on("Escape", () => {
      this.pop();
    });

    view.on("Space", () => {
      const player = this.props.save.getPlayer(db);
      player.props.view_radius = Math.min(50, player.props.view_radius + 0.5);
      player.save(db);
      view.render();
    });
  }
}
