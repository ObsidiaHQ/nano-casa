import { Component, OnInit } from '@angular/core';
import { PublicNode } from '../../../../server/models';
import { SharedService } from 'src/app/shared.service';

@Component({
  selector: 'app-public-nodes',
  templateUrl: './public-nodes.component.html',
  styleUrls: ['./public-nodes.component.css'],
})
export class PublicNodesComponent implements OnInit {
  nodes: PublicNode[] = [];

  constructor(private shared: SharedService) {}

  ngOnInit() {
    this.shared.publicNodes.subscribe((nodes) => (this.nodes = nodes));
  }
}
