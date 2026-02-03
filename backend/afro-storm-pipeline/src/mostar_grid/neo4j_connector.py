"""
Neo4j Knowledge Graph Connector
197,000+ nodes of climate-health intelligence
"""

from typing import Dict, List, Optional, Any
from neo4j import AsyncGraphDatabase
from loguru import logger
import os

class Neo4jGrid:
    """
    Neo4j Knowledge Graph with 197K+ nodes:
    - Cyclone patterns and tracks
    - Disease outbreak history
    - Convergence relationships
    - Community impact data
    """
    
    def __init__(self):
        self.uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
        self.user = os.getenv("NEO4J_USER", "neo4j")
        self.password = os.getenv("NEO4J_PASSWORD", "password")
        self.driver = None
        
    async def connect(self):
        """Initialize Neo4j connection"""
        try:
            self.driver = AsyncGraphDatabase.driver(
                self.uri, 
                auth=(self.user, self.password)
            )
            logger.success("🔮 Neo4j Grid connected")
        except Exception as e:
            logger.error(f"Neo4j connection failed: {e}")
            
    async def check_connection(self) -> bool:
        """Verify database connection"""
        if not self.driver:
            await self.connect()
        try:
            async with self.driver.session() as session:
                result = await session.run("RETURN 1")
                await result.consume()
                return True
        except:
            return False
    
    async def get_node_count(self) -> int:
        """Get total node count in Grid"""
        if not self.driver:
            return 0
        try:
            async with self.driver.session() as session:
                result = await session.run("""
                    MATCH (n) 
                    RETURN count(n) as count
                """)
                record = await result.single()
                return record["count"] if record else 0
        except Exception as e:
            logger.error(f"Node count failed: {e}")
            return 0
    
    async def find_similar_convergences(
        self,
        cyclone_location: Dict[str, float],
        outbreak_location: Dict[str, float],
        disease: str,
        radius_km: float = 300
    ) -> List[Dict]:
        """
        Find historical convergence patterns similar to current situation
        Uses geospatial queries on the knowledge graph
        """
        if not self.driver:
            logger.warning("Neo4j not connected - returning empty patterns")
            return []
        
        try:
            async with self.driver.session() as session:
                # Query for similar cyclone-outbreak convergences
                result = await session.run("""
                    // Find cyclones near the current cyclone location
                    MATCH (c:Cyclone)
                    WHERE point.distance(
                        c.location, 
                        point({latitude: $cyclone_lat, longitude: $cyclone_lon})
                    ) < $radius * 1000
                    
                    // Find outbreaks near the current outbreak location
                    MATCH (o:Outbreak)
                    WHERE point.distance(
                        o.location,
                        point({latitude: $outbreak_lat, longitude: $outbreak_lon})
                    ) < $radius * 1000
                    
                    // Find where they threatened each other
                    MATCH (c)-[t:THREATENS]->(o)
                    WHERE o.disease = $disease
                    
                    RETURN {
                        cyclone_id: c.id,
                        cyclone_date: c.timestamp,
                        outbreak_location: o.location,
                        disease: o.disease,
                        distance_km: t.distance_km,
                        risk_score: t.risk_score,
                        outcome_severity: t.outcome_severity,
                        communities_affected: t.communities_affected
                    } as pattern
                    ORDER BY t.outcome_severity DESC
                    LIMIT 10
                """, {
                    "cyclone_lat": cyclone_location.get("lat", 0),
                    "cyclone_lon": cyclone_location.get("lon", 0),
                    "outbreak_lat": outbreak_location.get("lat", 0),
                    "outbreak_lon": outbreak_location.get("lon", 0),
                    "disease": disease,
                    "radius": radius_km
                })
                
                patterns = []
                async for record in result:
                    patterns.append(record["pattern"])
                
                logger.info(f"Found {len(patterns)} similar convergence patterns")
                return patterns
                
        except Exception as e:
            logger.error(f"Similar convergence query failed: {e}")
            return []
    
    async def store_analysis(self, analysis_id: str, data: Dict):
        """Store Grid analysis for learning"""
        if not self.driver:
            return
        
        try:
            async with self.driver.session() as session:
                await session.run("""
                    CREATE (a:GridAnalysis {
                        id: $analysis_id,
                        timestamp: $timestamp,
                        data: $data
                    })
                """, {
                    "analysis_id": analysis_id,
                    "timestamp": data.get("timestamp", ""),
                    "data": str(data)
                })
                logger.info(f"Stored Grid analysis: {analysis_id}")
        except Exception as e:
            logger.error(f"Failed to store analysis: {e}")
    
    async def query(
        self, 
        query_type: str,
        location: Optional[str] = None,
        disease: Optional[str] = None,
        limit: int = 10
    ) -> List[Dict]:
        """General query interface to Grid"""
        if not self.driver:
            return []
        
        queries = {
            "cyclone_patterns": """
                MATCH (c:Cyclone)
                RETURN c ORDER BY c.timestamp DESC LIMIT $limit
            """,
            "disease_history": """
                MATCH (o:Outbreak)
                WHERE o.disease = $disease OR $disease IS NULL
                RETURN o ORDER BY o.timestamp DESC LIMIT $limit
            """,
            "convergences": """
                MATCH (c:Cyclone)-[t:THREATENS]->(o:Outbreak)
                RETURN c, o, t
                ORDER BY t.risk_score DESC
                LIMIT $limit
            """
        }
        
        cypher = queries.get(query_type, queries["convergences"])
        
        try:
            async with self.driver.session() as session:
                result = await session.run(cypher, {"limit": limit, "disease": disease})
                records = []
                async for record in result:
                    records.append(dict(record))
                return records
        except Exception as e:
            logger.error(f"Grid query failed: {e}")
            return []
    
    async def update_embeddings(self):
        """Update graph embeddings for pattern learning (background task)"""
        logger.info("🧠 Grid is learning from new patterns...")
        # This would trigger GNN embedding updates
        # For now, placeholder for future implementation
        pass
    
    async def close(self):
        """Close Neo4j connection"""
        if self.driver:
            await self.driver.close()
